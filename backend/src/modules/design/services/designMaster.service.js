import { randomUUID } from "node:crypto";

import ApiError from "../../../core/apiError.js";
import { db } from "../../../database/index.js";

import designMasterRepository from "../repositories/designMaster.repository.js";
import designSemiSetRepository from "../repositories/designSemiSet.repository.js";
import designSemiSetSizeRepository from "../repositories/designSemiSetSize.repository.js";
import colorVariantRepository, { normalizeColorName } from "../repositories/colorVariant.repository.js";
import { normalizeDesignCode } from "../repositories/design.repository.js";
import designService from "./design.service.js";
import mediaUploadService from "../../../core/media/mediaUploadService.js";
import currentStockOverviewService from "../../inventory/services/currentStockOverview.service.js";
import stockGroupRepository from "../../stock/repositories/stockGroup.repository.js";
import stockItemRepository from "../../stock/repositories/stockItem.repository.js";
import { buildBundleCompositionSignature } from "../../stock/services/stockInPersistence.service.js";

const sameLabel = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

class DesignMasterService {
    _repository = designMasterRepository;
    _designSemiSetRepository = designSemiSetRepository;
    _designSemiSetSizeRepository = designSemiSetSizeRepository;
    _colorVariantRepository = colorVariantRepository;
    _designService = designService;
    _mediaUploadService = mediaUploadService;
    _stockService = currentStockOverviewService;
    _stockGroupRepository = stockGroupRepository;
    _stockItemRepository = stockItemRepository;

    // Design Master dashboard: one page of designs (searchable/sortable server-side), each with its
    // active colour variants and set composition (one representative variant's active sizes —
    // every variant of a design shares the same size list).
    async listDesigns({ page, limit, keyword, sort }) {
        const offset = (page - 1) * limit;
        const [designs, total, totalAll] = await Promise.all([
            this._repository.findPage(db, { limit, offset, keyword, sort }),
            this._repository.countFiltered(db, { keyword }),
            this._repository.countAll(db),
        ]);

        const variants = await this._repository.findVariants(db, designs.map((row) => row.id));
        const variantsByDesign = new Map();
        for (const variant of variants) {
            if (!variantsByDesign.has(variant.designId)) variantsByDesign.set(variant.designId, []);
            variantsByDesign.get(variant.designId).push(variant);
        }
        const representativeIds = designs.map((row) => variantsByDesign.get(row.id)?.[0]?.id).filter(Boolean);
        const sizes = (await this._repository.findSizes(db, representativeIds)).filter((size) => size.isActive);

        return {
            data: designs.map((row) => {
                const designVariants = variantsByDesign.get(row.id) ?? [];
                const representativeId = designVariants[0]?.id;
                return {
                    ...row,
                    colorVariants: designVariants.map((variant) => ({
                        id: variant.id,
                        colorName: variant.colorName,
                        colorHex: variant.colorHex,
                        imageUrl: variant.imageUrl,
                    })),
                    setComposition: sizes
                        .filter((size) => size.variantId === representativeId)
                        .map((size) => ({ id: size.id, sizeLabel: size.sizeLabel, displayOrder: size.displayOrder, includedInSet: size.includedInSet })),
                };
            }),
            meta: { page, limit, total, totalAll, totalPages: Math.ceil(total / limit) },
        };
    }

    // One design for the preview drawer and the edit wizard — with how much stock each variant and
    // each size holds, so the UI can say what can't be removed yet.
    async getDesign(id) {
        // Independent reads run in parallel — the database is remote, so round trips dominate.
        const [row, variants] = await Promise.all([this._repository.findDetail(db, id), this._repository.findVariants(db, [id])]);
        if (!row) throw new ApiError(`Design ${id} not found.`, 404, "DESIGN_NOT_FOUND");

        const representative = variants[0];
        const [stock, allSizes, semiSets] = await Promise.all([
            this._stockService.getVariantsStock(db, variants.map((variant) => variant.id)),
            representative ? this._repository.findSizes(db, [representative.id]) : [],
            representative ? this._repository.findSemiSetsWithLabels(db, representative.id) : [],
        ]);
        const sizes = allSizes.filter((size) => size.isActive);

        const piecesBySize = new Map();
        for (const variantStock of stock.values()) {
            for (const size of variantStock.sizes) piecesBySize.set(size.size, (piecesBySize.get(size.size) ?? 0) + size.quantity);
        }

        return {
            ...row,
            sizes: sizes.map((size) => ({
                sizeLabel: size.sizeLabel,
                displayOrder: size.displayOrder,
                includedInSet: size.includedInSet,
                piecesInStock: piecesBySize.get(size.sizeLabel) ?? 0,
            })),
            semiSets: semiSets.filter((semiSet) => semiSet.sizeLabels.length > 0),
            colorVariants: variants.map((variant) => {
                const variantStock = stock.get(variant.id);
                return {
                    id: variant.id,
                    colorName: variant.colorName,
                    colorHex: variant.colorHex,
                    imageUrl: variant.imageUrl,
                    piecesInStock: variantStock?.totalPieces ?? 0,
                    completeSets: variantStock?.sets ?? 0,
                };
            }),
        };
    }

    // Full edit: identity, sizes (add / remove / reorder), semi sets, and variants (rename,
    // recolour, replace photo, add, remove). Stock stays consistent:
    //   - a size or variant that still has pieces in stock can't be removed (sell, write off or
    //     break the sets first) — once empty it is deactivated, never deleted (history keeps it);
    //   - adding a set size turns a variant's existing complete sets into semi sets of the old
    //     sizes, because those physical sets don't contain the new size.
    // `files` are the new photos, in order, for each variant that is new or has replaceImage set.
    async updateDesign(id, data, files = []) {
        const { colorVariants, designSizes, semiSets, jobberId, jobberName, qualityId, quality, patternId, name, code, itemNameId, itemName, defaultSellingPricePerPiece, notes } = data;

        const needsImage = colorVariants.filter((variant) => !variant.id || variant.replaceImage);
        if (needsImage.length !== files.length) {
            throw new ApiError(
                `Expected ${needsImage.length} photo(s) for new or replaced variants, received ${files.length}.`,
                400,
                "VARIANT_IMAGE_COUNT_MISMATCH",
            );
        }
        const sizeLabels = designSizes.map((size) => size.sizeLabel.trim());
        if (new Set(sizeLabels.map((label) => label.toLowerCase())).size !== sizeLabels.length) {
            throw new ApiError("Each size can only appear once.", 400, "DUPLICATE_SIZE");
        }
        const colorKeys = colorVariants.map((variant) => normalizeColorName(variant.colorName));
        if (new Set(colorKeys).size !== colorKeys.length) {
            throw new ApiError("Two variants have the same colour name.", 400, "DUPLICATE_VARIANT");
        }

        const uploaded = await this._mediaUploadService.uploadDesignColorVariantImages(files);
        const replacedImages = [];

        try {
            const result = await db.transaction(async (tx) => {
                const existing = await this._repository.lockDesign(tx, id);
                if (!existing) throw new ApiError(`Design ${id} not found.`, 404, "DESIGN_NOT_FOUND");

                // --- identity ---------------------------------------------------------------
                const pattern = await this._designService._resolvePattern(tx, { patternId, patternName: name });
                const normalizedCode = normalizeDesignCode(code);
                const clash = await this._repository.findOtherByIdentity(tx, { patternId: pattern.id, normalizedCode, excludeId: id });
                if (clash) throw new ApiError("Another design already has this pattern and design code.", 409, "DESIGN_ALREADY_EXISTS");
                const resolvedQuality = await this._designService._resolveQuality(tx, { qualityId, qualityName: quality });
                const resolvedJobberId = await this._designService._resolveJobberId(tx, { jobberId, jobberName });
                const resolvedItemName = await this._designService._resolveItemName(tx, { itemNameId, itemName });

                await this._repository.updateDesign(tx, id, {
                    name: pattern.name,
                    patternId: pattern.id,
                    code: code?.trim() || null,
                    normalizedCode,
                    itemName: resolvedItemName.name,
                    itemNameId: resolvedItemName.id,
                    quality: resolvedQuality.name,
                    qualityId: resolvedQuality.id,
                    jobberId: resolvedJobberId,
                    defaultSellingPricePerPiece,
                    notes: notes?.trim() || null,
                });

                // --- variants ---------------------------------------------------------------
                const currentVariants = await this._repository.findVariants(tx, [id]);
                const currentById = new Map(currentVariants.map((variant) => [variant.id, variant]));
                for (const variant of colorVariants) {
                    if (variant.id && !currentById.has(variant.id)) {
                        throw new ApiError(`Variant ${variant.id} doesn't belong to this design.`, 400, "VARIANT_NOT_IN_DESIGN");
                    }
                }

                const keptIds = new Set(colorVariants.filter((variant) => variant.id).map((variant) => variant.id));
                const removed = currentVariants.filter((variant) => !keptIds.has(variant.id));
                // Stock only matters when something is removed or the size list changes (removal
                // checks, and set→semi conversion when a set size is added) — skip the reads otherwise.
                const currentSizes = await this._repository.findSizes(tx, currentVariants.slice(0, 1).map((variant) => variant.id));
                const currentLabels = currentSizes.filter((size) => size.isActive).map((size) => size.sizeLabel.toLowerCase()).sort();
                const wantedLabels = designSizes.map((size) => size.sizeLabel.trim().toLowerCase()).sort();
                const sizesChanged = JSON.stringify(currentLabels) !== JSON.stringify(wantedLabels);
                const stock = removed.length > 0 || sizesChanged
                    ? await this._stockService.getVariantsStock(tx, currentVariants.map((variant) => variant.id))
                    : new Map();

                for (const variant of removed) {
                    const variantStock = stock.get(variant.id);
                    const pieces = Math.max(variantStock?.totalPieces ?? 0, variantStock?.ledgerPieces ?? 0);
                    if (pieces > 0) {
                        throw new ApiError(
                            `${variant.colorName} still has ${pieces} piece(s) in stock — sell or write them off in Current Stock before removing this variant.`,
                            409,
                            "VARIANT_HAS_STOCK",
                        );
                    }
                }
                for (const variant of removed) {
                    // Freed-up colour name, so the same colour can be added again later.
                    await this._repository.updateVariant(tx, variant.id, { isActive: false, normalizedColorName: `${variant.normalizedColorName.slice(0, 70)}#removed-${variant.id}` });
                }

                let imageIndex = 0;
                const createdVariantIds = [];
                for (const [index, variant] of colorVariants.entries()) {
                    const image = !variant.id || variant.replaceImage ? uploaded[imageIndex++] : null;
                    if (variant.id) {
                        const current = currentById.get(variant.id);
                        const patch = { colorName: variant.colorName.trim(), colorHex: variant.colorHex.toUpperCase(), normalizedColorName: colorKeys[index] };
                        const unchanged = !image && current.colorName === patch.colorName && current.colorHex.toUpperCase() === patch.colorHex
                            && current.normalizedColorName === patch.normalizedColorName;
                        if (unchanged) continue;
                        if (image) {
                            patch.imageUrl = image.imageUrl;
                            patch.imagePublicId = image.imagePublicId;
                            replacedImages.push({ imageUrl: current.imageUrl, imagePublicId: current.imagePublicId });
                        }
                        await this._repository.updateVariant(tx, variant.id, patch);
                    } else {
                        const [created] = await this._colorVariantRepository.createMany(tx, [{
                            designId: id,
                            colorName: variant.colorName.trim(),
                            colorHex: variant.colorHex.toUpperCase(),
                            normalizedColorName: colorKeys[index],
                            imageUrl: image.imageUrl,
                            imagePublicId: image.imagePublicId,
                            qrPayload: randomUUID(),
                            qrGeneratedAt: new Date(),
                        }]);
                        createdVariantIds.push(created.id);
                    }
                }

                // --- sizes (every active variant gets the same list) ------------------------
                const activeVariantIds = [...keptIds, ...createdVariantIds];
                const allSizes = await this._repository.findSizes(tx, activeVariantIds);
                const convertedSets = [];

                for (const variantId of activeVariantIds) {
                    const sizes = allSizes.filter((size) => size.variantId === variantId);
                    const active = sizes.filter((size) => size.isActive);
                    const variantStock = stock.get(variantId);
                    const variantName = currentById.get(variantId)?.colorName ?? "New variant";

                    // Removing: only once no piece of that size is left in stock (loose or in a set).
                    for (const size of active) {
                        if (designSizes.some((wanted) => sameLabel(wanted.sizeLabel, size.sizeLabel))) continue;
                        const pieces = variantStock?.sizes.find((row) => row.designSizeId === size.id)?.quantity ?? 0;
                        if (pieces > 0) {
                            throw new ApiError(
                                `${variantName} still has ${pieces} piece(s) of size ${size.sizeLabel} in stock (loose or inside sets) — sell, write off or break those first before removing the size.`,
                                409,
                                "SIZE_HAS_STOCK",
                            );
                        }
                        await this._repository.updateSize(tx, size.id, { isActive: false });
                    }

                    // Adding a set size: existing complete sets don't contain it → they become semi sets.
                    const oldSetSizes = active.filter((size) => size.includedInSet && designSizes.some((wanted) => sameLabel(wanted.sizeLabel, size.sizeLabel)));
                    const addsSetSize = designSizes.some((wanted) => (wanted.includedInSet ?? true) && !active.some((size) => sameLabel(size.sizeLabel, wanted.sizeLabel)));
                    if (addsSetSize && (variantStock?.sets ?? 0) > 0 && oldSetSizes.length > 0) {
                        const group = await this._stockGroupRepository.findOrCreate(tx, {
                            colorVariantId: variantId,
                            type: "BUNDLE",
                            compositionSignature: buildBundleCompositionSignature(oldSetSizes.map((size) => ({ designSizeId: size.id, quantity: 1 }))),
                        });
                        const converted = await this._stockItemRepository.convertSetsToBundles(tx, variantId, group.id);
                        convertedSets.push({ colorVariantId: variantId, colorName: variantName, sets: converted.length });
                    }

                    // Upsert the wanted list in order (reactivating a previously removed label).
                    const toInsert = [];
                    for (const [displayOrder, wanted] of designSizes.entries()) {
                        const match = sizes.find((size) => sameLabel(size.sizeLabel, wanted.sizeLabel));
                        const patch = { displayOrder, includedInSet: wanted.includedInSet ?? true, isActive: true };
                        if (match) {
                            const unchanged = match.displayOrder === patch.displayOrder && match.includedInSet === patch.includedInSet && match.isActive;
                            if (!unchanged) await this._repository.updateSize(tx, match.id, patch);
                        } else toInsert.push({ variantId, sizeLabel: wanted.sizeLabel.trim(), ...patch });
                    }
                    await this._repository.insertSizes(tx, toInsert);
                }

                // --- semi-set definitions (replaced for every active variant, only if changed) --
                const representativeId = [...keptIds][0];
                const currentSemiSets = representativeId ? await this._repository.findSemiSetsWithLabels(tx, representativeId) : [];
                const semiKey = (list) => JSON.stringify(list.map((semiSet) => [semiSet.label.trim(), [...semiSet.sizeLabels].map((label) => label.toLowerCase()).sort()]));
                const semiSetsChanged = createdVariantIds.length > 0 || semiKey(currentSemiSets) !== semiKey(semiSets);
                if (semiSetsChanged) await this._repository.deleteSemiSets(tx, activeVariantIds);
                if (semiSetsChanged && semiSets.length && activeVariantIds.length) {
                    const finalSizes = (await this._repository.findSizes(tx, activeVariantIds)).filter((size) => size.isActive);
                    const inserted = await this._designSemiSetRepository.createMany(tx, activeVariantIds.flatMap((variantId) =>
                        semiSets.map((semiSet, displayOrder) => ({ variantId, label: semiSet.label, displayOrder }))));
                    const sizeRows = inserted.flatMap((row) => {
                        const definition = semiSets[row.displayOrder];
                        return definition.sizeLabels
                            .map((label) => finalSizes.find((size) => size.variantId === row.variantId && sameLabel(size.sizeLabel, label)))
                            .filter(Boolean)
                            .map((size) => ({ semiSetId: row.id, designSizeId: size.id }));
                    });
                    if (sizeRows.length) await this._designSemiSetSizeRepository.createMany(tx, sizeRows);
                }

                return { convertedSets, removedVariants: removed.map((variant) => variant.colorName), addedVariants: createdVariantIds.length };
            });

            if (replacedImages.length) await this._mediaUploadService.deleteUploadedImages(replacedImages);
            // The editor navigates away after saving, so only what changed is returned (a full
            // reload is a separate GET /designs/:id).
            return { id, changes: result };
        } catch (error) {
            await this._mediaUploadService.deleteUploadedImages(uploaded);
            throw this._designService._translateDuplicateError(error);
        }
    }
}

export default new DesignMasterService();
