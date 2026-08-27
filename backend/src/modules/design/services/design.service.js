import { randomUUID } from "node:crypto";

import ApiError from "../../../core/apiError.js";

import { db } from "../../../database/index.js";
import designRepository, { normalizeDesignCode } from "../repositories/design.repository.js";
import colorVariantRepository, { normalizeColorName } from "../repositories/colorVariant.repository.js";
import designSizeRepository from "../repositories/designSize.repository.js";
import designSemiSetRepository from "../repositories/designSemiSet.repository.js";
import designSemiSetSizeRepository from "../repositories/designSemiSetSize.repository.js";
import jobberRepository from "../repositories/jobber.repository.js";
import qualityRepository from "../repositories/quality.repository.js";
import patternRepository from "../repositories/pattern.repository.js";
import itemNameRepository from "../repositories/itemName.repository.js";
import mediaUploadService from "../../../core/media/mediaUploadService.js";

const DUPLICATE_DESIGN_MESSAGE = "Design already exists in the database.";
const DESIGN_IDENTITY_CONSTRAINT = "designs_pattern_id_normalized_code_unique_idx";
const COLOR_VARIANT_IDENTITY_CONSTRAINT = "color_variants_design_id_normalized_color_name_unique_idx";

class DesignService {
    _designRepository = designRepository;
    _colorVariantRepository = colorVariantRepository;
    _designSizeRepository = designSizeRepository;
    _designSemiSetRepository = designSemiSetRepository;
    _designSemiSetSizeRepository = designSemiSetSizeRepository;
    _jobberRepository = jobberRepository;
    _qualityRepository = qualityRepository;
    _patternRepository = patternRepository;
    _itemNameRepository = itemNameRepository;
    _mediaUploadService = mediaUploadService;

    async registerDesign(data, files = []) {
        const { colorVariants, designSizes = [], semiSets = [], jobberId, jobberName, qualityId, quality, patternId, name, code, itemNameId, itemName, ...designData } = data;

        if (colorVariants.length !== files.length) {
            throw new ApiError(
                `Expected exactly one image per color variant: received ${colorVariants.length} variant(s) and ${files.length} image(s).`,
                400,
                "VARIANT_IMAGE_COUNT_MISMATCH"
            );
        }

        const normalizedCode = normalizeDesignCode(code);

        // Resolving the pattern (read-or-create) up front never creates an orphan on the reject
        // path below: a brand-new pattern can't already have a design against it, so the
        // duplicate check that follows only ever finds a match when the pattern already existed.
        const resolvedPattern = await this._resolvePattern(db, { patternId, patternName: name });

        // Design identity is (pattern, code). A matching design row alone is NOT rejected here —
        // the same code can legitimately gain a new colour over time (e.g. "Paisley Straight /
        // FL205" starting with just Blue and later getting Green added). Only reject when every
        // submitted colour already exists on that design too — at that point nothing in the
        // submission is new (see REQUIRED BEHAVIOR).
        const existingDesign = await this._designRepository.findByIdentity(db, {
            patternId: resolvedPattern.id,
            normalizedCode,
        });

        const existingVariantsByColor = new Map();
        if (existingDesign) {
            const existingVariants = await this._colorVariantRepository.findActiveByDesignId(db, existingDesign.id);
            for (const variant of existingVariants) {
                existingVariantsByColor.set(variant.normalizedColorName, variant);
            }

            const nothingNewSubmitted = colorVariants.every(
                (color) => existingVariantsByColor.has(normalizeColorName(color.colorName))
            );
            if (nothingNewSubmitted) {
                throw new ApiError(DUPLICATE_DESIGN_MESSAGE, 409, "DESIGN_ALREADY_EXISTS");
            }
        }

        // Cloudinary is a separate system from PostgreSQL and can't participate in the
        // db.transaction below — uploading here, before the transaction opens, keeps the
        // transaction free of network I/O and gives us publicIds to clean up on failure.
        const uploadedImages = await this._mediaUploadService.uploadDesignColorVariantImages(files);
        // Images for colours that turn out to already exist on the matched design are never
        // attached to a row — cleaned up from storage after the transaction commits (failure
        // cleanup is handled by the catch below instead).
        const unusedImages = [];

        try {
            const result = await db.transaction(async (tx) => {
                let design = existingDesign;

                if (!design) {
                    const resolvedJobberId = await this._resolveJobberId(tx, { jobberId, jobberName });
                    const resolvedQuality = await this._resolveQuality(tx, { qualityId, qualityName: quality });
                    const resolvedItemName = await this._resolveItemName(tx, { itemNameId, itemName });

                    design = await this._designRepository.create(tx, {
                        ...designData,
                        code,
                        normalizedCode,
                        jobberId: resolvedJobberId,
                        qualityId: resolvedQuality.id,
                        quality: resolvedQuality.name,
                        itemNameId: resolvedItemName.id,
                        itemName: resolvedItemName.name,
                        patternId: resolvedPattern.id,
                        name: resolvedPattern.name,
                    });
                }

                //todo: service knows the persistent structure of color variant introducing some coupling in open/close principle
                const createdVariants = [];
                const reusedVariants = [];
                for (const [index, color] of colorVariants.entries()) {
                    const normalizedColorName = normalizeColorName(color.colorName);
                    const matchedVariant = existingVariantsByColor.get(normalizedColorName);

                    if (matchedVariant) {
                        unusedImages.push(uploadedImages[index]);
                        reusedVariants.push(matchedVariant);
                        continue;
                    }

                    const [createdVariant] = await this._colorVariantRepository.createMany(tx, [{
                        designId: design.id,
                        colorName: color.colorName,
                        colorHex: color.colorHex,
                        normalizedColorName,
                        imageUrl: uploadedImages[index].imageUrl,
                        imagePublicId: uploadedImages[index].imagePublicId,
                        // qrService isn't implemented yet; a random unique payload satisfies the
                        // NOT NULL constraint without blocking variant creation on this feature
                        qrPayload: randomUUID(),
                        qrGeneratedAt: new Date(),
                    }]);
                    createdVariants.push(createdVariant);
                }

                //todo: service knows the persistent structure of design size introducing some coupling in open/close principle
                // designSizes belong to a color variant (variantId), not the design directly —
                // the same size set is applied to every newly created variant in this request;
                // pre-existing variants (colours already on the design) are left untouched.
                const sizes = createdVariants.flatMap(variant =>
                    designSizes.map(size => ({
                        variantId: variant.id,
                        sizeLabel: size.sizeLabel,
                        displayOrder: size.displayOrder,
                        unsetPricePerSize: size.unsetPricePerSize,
                        includedInSet: size.includedInSet,
                    }))
                );
                const createdSizes = sizes.length > 0
                    ? await this._designSizeRepository.createMany(tx, sizes)
                    : [];

                //todo: service knows the persistent structure of semi sets, same coupling as designSizes above
                // Each semi set is created once per newly created variant, resolving its sizeLabels
                // against that variant's just-created designSize rows (a semi set can't reference a
                // size that isn't also part of the variant's own size list).
                const createdSemiSets = [];
                if (semiSets.length > 0 && createdVariants.length > 0) {
                    const sizeIdByVariantAndLabel = new Map(
                        createdSizes.map((size) => [`${size.variantId}:${size.sizeLabel}`, size.id])
                    );
                    // sizeLabels per (variantId, semi set label) — looked back up after insert since
                    // designSemiSet rows don't carry sizeLabels themselves.
                    const sizeLabelsByVariantAndLabel = new Map();
                    for (const variant of createdVariants) {
                        for (const semiSet of semiSets) {
                            sizeLabelsByVariantAndLabel.set(`${variant.id}:${semiSet.label}`, semiSet.sizeLabels);
                        }
                    }

                    const semiSetRows = createdVariants.flatMap((variant) =>
                        semiSets.map((semiSet) => ({
                            variantId: variant.id,
                            label: semiSet.label,
                            displayOrder: semiSet.displayOrder,
                        }))
                    );
                    const insertedSemiSets = await this._designSemiSetRepository.createMany(tx, semiSetRows);

                    const semiSetSizeRows = insertedSemiSets.flatMap((insertedSemiSet) => {
                        const sizeLabels = sizeLabelsByVariantAndLabel.get(`${insertedSemiSet.variantId}:${insertedSemiSet.label}`) ?? [];
                        return sizeLabels
                            .map((sizeLabel) => sizeIdByVariantAndLabel.get(`${insertedSemiSet.variantId}:${sizeLabel}`))
                            .filter(Boolean)
                            .map((designSizeId) => ({ semiSetId: insertedSemiSet.id, designSizeId }));
                    });
                    if (semiSetSizeRows.length > 0) {
                        await this._designSemiSetSizeRepository.createMany(tx, semiSetSizeRows);
                    }

                    createdSemiSets.push(...insertedSemiSets);
                }

                return {
                    design,
                    colorVariants: [...reusedVariants, ...createdVariants],
                    designSizes: createdSizes,
                    semiSets: createdSemiSets,
                    isNewDesign: !existingDesign,
                };
            });

            if (unusedImages.length > 0) {
                await this._mediaUploadService.deleteUploadedImages(unusedImages);
            }

            return result;
        } catch (error) {
            await this._mediaUploadService.deleteUploadedImages(uploadedImages);
            throw this._translateDuplicateError(error);
        }
    }

    // The pre-check above closes the normal-case race window; this only fires if two identical
    // submissions land inside it concurrently (either two brand-new designs with the same
    // pattern+code, or two requests adding the same new colour to the same existing design).
    // Rewritten to the same friendly 409 so a genuine race is indistinguishable from the
    // ordinary reject path — the DB's raw unique-violation detail is never shown to the user.
    _translateDuplicateError(error) {
        const constraint = error?.cause?.constraint ?? error?.originalError?.cause?.constraint;

        if (constraint === DESIGN_IDENTITY_CONSTRAINT || constraint === COLOR_VARIANT_IDENTITY_CONSTRAINT) {
            return new ApiError(DUPLICATE_DESIGN_MESSAGE, 409, "DESIGN_ALREADY_EXISTS");
        }

        return error;
    }

    async getAllDesigns({ page, limit }) {
        const offset = (page - 1) * limit;

        const [designs, total] = await Promise.all([
            this._designRepository.findAll({ limit, offset }),
            this._designRepository.count(),
        ]);

        const variants = await this._colorVariantRepository.findByDesignIds(designs.map((design) => design.id));
        const variantsByDesignId = this._groupVariantsByDesignId(variants);

        // every variant of a design shares the same size set — one representative variant per design is enough
        const representativeVariantIds = designs
            .map((design) => variantsByDesignId[design.id]?.[0]?.id)
            .filter(Boolean);

        const sizes = await this._designSizeRepository.findByVariantIds(representativeVariantIds);
        const sizesByVariantId = sizes.reduce((acc, size) => {
            (acc[size.variantId] ??= []).push(size);
            return acc;
        }, {});

        return {
            data: designs.map((design) => {
                const representativeVariantId = variantsByDesignId[design.id]?.[0]?.id;

                return {
                    ...design,
                    colorVariants: variantsByDesignId[design.id] ?? [],
                    setComposition: sizesByVariantId[representativeVariantId] ?? [],
                };
            }),
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async searchDesign(keyword) {
        if (!keyword?.trim()) {
            throw new ApiError("Search keyword is required.", 400);
        };

        const designs = await this._designRepository.search(keyword.trim());

        const variants = await this._colorVariantRepository.findByDesignIds(designs.map((design) => design.id));
        const variantsByDesignId = this._groupVariantsByDesignId(variants);

        return designs.map((design) => ({
            ...design,
            colorVariants: variantsByDesignId[design.id] ?? [],
        }));
    }

    async searchJobbers(keyword) {
        if (!keyword?.trim()) {
            throw new ApiError("Search keyword is required.", 400);
        }

        return this._jobberRepository.search(keyword.trim());
    }

    // Backend stays authoritative: an incoming jobberId is only trusted if it still resolves to
    // a real row (it may be stale if the jobber was resolved from a search result that's since
    // been superseded); a name with no id is resolved/created by name. Runs inside the caller's
    // transaction so a newly created jobber is rolled back along with the rest of the design if
    // anything downstream fails.
    async _resolveJobberId(tx, { jobberId, jobberName }) {
        if (jobberId) {
            const existing = await this._jobberRepository.findById(tx, jobberId);
            if (existing) return existing.id;
        }

        if (jobberName?.trim()) {
            const jobber = await this._jobberRepository.findOrCreate(tx, jobberName.trim());
            return jobber.id;
        }

        return null;
    }

    async searchQualities(keyword) {
        if (!keyword?.trim()) {
            throw new ApiError("Search keyword is required.", 400);
        }

        return this._qualityRepository.search(keyword.trim());
    }

    // Mirrors _resolveJobberId, but quality is required on register (unlike jobber): the
    // validator guarantees qualityName is a non-blank string, so this always resolves to a
    // real row. Returns both id and name — name is stored denormalized on the design row
    // alongside qualityId (see registerDesign).
    async _resolveQuality(tx, { qualityId, qualityName }) {
        if (qualityId) {
            const existing = await this._qualityRepository.findById(tx, qualityId);
            if (existing) return existing;
        }

        return this._qualityRepository.findOrCreate(tx, qualityName.trim());
    }

    async getItemNames() {
        return this._itemNameRepository.findAll();
    }

    // Mirrors _resolveQuality — item name is required, so this always resolves to a real row,
    // creating it when the user typed a new name. Returns both id and name (name is stored
    // denormalized on the design row alongside itemNameId).
    async _resolveItemName(tx, { itemNameId, itemName }) {
        if (itemNameId) {
            const existing = await this._itemNameRepository.findById(tx, itemNameId);
            if (existing) return existing;
        }

        return this._itemNameRepository.findOrCreate(tx, itemName.trim());
    }

    async searchPatterns(keyword) {
        if (!keyword?.trim()) {
            throw new ApiError("Search keyword is required.", 400);
        }

        return this._patternRepository.search(keyword.trim());
    }

    // Mirrors _resolveQuality — pattern (the design "name", e.g. Anarkali/Straight/Flair) is
    // required on register, so this always resolves to a real row. Returns both id and name —
    // name is stored denormalized on the design row alongside patternId (see registerDesign).
    async _resolvePattern(tx, { patternId, patternName }) {
        if (patternId) {
            const existing = await this._patternRepository.findById(tx, patternId);
            if (existing) return existing;
        }

        return this._patternRepository.findOrCreate(tx, patternName.trim());
    }

    async getActiveVariantSizes(colorVariantId) {
        const variant = await this._colorVariantRepository.findActiveById(db, colorVariantId);
        if (!variant) {
            throw new ApiError(`Color variant ${colorVariantId} not found or inactive.`, 404, "VARIANT_NOT_FOUND");
        }

        return this._designSizeRepository.findActiveByVariantId(db, colorVariantId);
    }

    // Named semi sets for a variant, each with its composing sizes resolved — Stock In's Set
    // Matrix step uses this to offer "+ Add Semi Set" alongside the full set.
    async getVariantSemiSets(colorVariantId) {
        const variant = await this._colorVariantRepository.findActiveById(db, colorVariantId);
        if (!variant) {
            throw new ApiError(`Color variant ${colorVariantId} not found or inactive.`, 404, "VARIANT_NOT_FOUND");
        }

        const semiSets = await this._designSemiSetRepository.findByVariantId(db, colorVariantId);
        if (semiSets.length === 0) return [];

        const semiSetSizes = await this._designSemiSetSizeRepository.findBySemiSetIds(db, semiSets.map((semiSet) => semiSet.id));
        const allSizes = await this._designSizeRepository.findActiveByVariantId(db, colorVariantId);
        const sizeById = new Map(allSizes.map((size) => [size.id, size]));

        const sizesBySemiSetId = new Map();
        for (const semiSetSize of semiSetSizes) {
            const size = sizeById.get(semiSetSize.designSizeId);
            if (!size) continue;
            if (!sizesBySemiSetId.has(semiSetSize.semiSetId)) sizesBySemiSetId.set(semiSetSize.semiSetId, []);
            sizesBySemiSetId.get(semiSetSize.semiSetId).push(size);
        }

        return semiSets.map((semiSet) => ({
            ...semiSet,
            sizes: (sizesBySemiSetId.get(semiSet.id) ?? []).sort((a, b) => a.displayOrder - b.displayOrder),
        }));
    }

    _groupVariantsByDesignId(variants) {
        return variants.reduce((acc, variant) => {
            (acc[variant.designId] ??= []).push(variant);
            return acc;
        }, {});
    }
}

export default new DesignService();
