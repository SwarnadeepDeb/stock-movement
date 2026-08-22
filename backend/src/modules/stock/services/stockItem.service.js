import ApiError from "../../../core/apiError.js";
import { db } from "../../../database/index.js";

import { parseBundleCompositionSignature } from "./stockInPersistence.service.js";

import stockItemRepository from "../repositories/stockItem.repository.js";
import colorVariantRepository from "../../design/repositories/colorVariant.repository.js";
import designSizeRepository from "../../design/repositories/designSize.repository.js";
import stockGroupRepository from "../repositories/stockGroup.repository.js";
import stockItemLineageRepository from "../repositories/stockItemLineage.repository.js";
import stockQrService from "./stockQr.service.js";
import stockHistoryService from "./stockHistory.service.js";

// Business vocabulary at the API boundary (SET/UNSET), mapped to the DB's AVAILABLE/UNSET inside the service
const API_TO_DB_STATUS = { SET: "AVAILABLE", UNSET: "UNSET" };

class StockItemService {
    _stockItemRepository = stockItemRepository;
    _colorVariantRepository = colorVariantRepository;
    _designSizeRepository = designSizeRepository;
    _stockGroupRepository = stockGroupRepository;
    _stockItemLineageRepository = stockItemLineageRepository;
    _stockQrService = stockQrService;
    _stockHistoryService = stockHistoryService;

    async transitionStatus(id, targetStatus) {
        return db.transaction(async (tx) => {
            const to = API_TO_DB_STATUS[targetStatus];
            const form = to === "AVAILABLE" ? "UNSET" : "AVAILABLE";
            const unsetAt = to === "UNSET" ? new Date() : null;

            const updated = await this._stockItemRepository.updateStatusIfCurrentAndFlippable(tx, id, { form, to, unsetAt });
            if (updated) return updated;

            // CAS missed — read to find out exactly why, and report the right error
            const current = await this._stockItemRepository.findById(tx, id);
            if (!current) {
                throw new ApiError(`Stock item ${id} not found.`, 404, "STOCK_ITEM_NOT_FOUND");
            }
            if (current.type === "LOOSE_PIECE") {
                throw new ApiError(`Loose piece stock items cannot change status directly.`, 400, "LOOSE_PIECE_STATUS_IMMUTABLE");
            }
            if (current.status === "CONSUMED") {
                throw new ApiError(`Stock item ${id} has been consumed and cannot change status.`, 400, "STOCK_ITEM_CONSUMED");
            }
            if (current.status === to) {
                return current; // idempotent: already at the requested status
            }

            throw new ApiError(`Stock item ${id} status changed concurrently; retry.`, 409, "STOCK_ITEM_STATUS_CONFLICT");
        })
    }

    // quantity = how many complete SETs to assemble in one call. Every required size
    // contributes exactly `quantity` loose pieces — one SET can never be partially built
    // (see §23 of the transformation spec: consumed per size === sets created).
    async assembleSet(colorVariantId, quantity = 1) {
        return db.transaction(async (tx) => {
            const variant = await this._colorVariantRepository.findActiveById(tx, colorVariantId);
            if (!variant) {
                throw new ApiError(`Color variant ${colorVariantId} not found or inactive.`, 404, "VARIANT_NOT_FOUND");
            }

            const activeSizes = await this._designSizeRepository.findActiveByVariantId(tx, colorVariantId);
            // same business rule used by _addCompleteSets() during registration need to ensure assembly also follow the same business principle
            const setSizes = activeSizes.filter((size) => size.includedInSet);
            if (setSizes.length === 0) {
                throw new ApiError(`Color variant ${colorVariantId} has no sizes configured as part of a set.`, 400, "NO_SET_SIZES");
            }

            // Lock `quantity` loose pieces per required size. lockedBySize[i] lines up with
            // setSizes[i], and within it, lockedBySize[i][j] is the piece consumed by SET #j.
            const lockedBySize = [];
            const shortSizes = [];
            for (const size of setSizes) {
                const locked = await this._stockItemRepository.findAndLockAvailableBySize(tx, colorVariantId, size.id, quantity);
                if (locked.length < quantity) {
                    shortSizes.push({ designSizeId: size.id, needed: quantity, available: locked.length });
                }
                lockedBySize.push(locked);
            }
            if (shortSizes.length > 0) {
                throw new ApiError(`Not enough loose pieces to assemble ${quantity} SET(s): ${JSON.stringify(shortSizes)}.`, 409, "INSUFFICIENT_LOOSE_PIECES");
            }

            // all required pieces are found
            const setGroup = await this._stockGroupRepository.findOrCreate(tx, { colorVariantId, type: "SET" });

            // create `quantity` new stock items, one per SET
            const created = await this._stockItemRepository.createMany(tx,
                Array.from({ length: quantity }, () => ({
                    stockGroupId: setGroup.id,
                    colorVariantId,
                    // because these sets weren't directly received from one stock-in transaction.
                    stockInTransactionId: null,
                    bundleId: null,
                    type: "SET",
                    status: "AVAILABLE",
                }))
            );

            const generatedQrs = await this._stockQrService.generateForStockItems(tx, created, {
                designCode: variant.designCode,
                designName: variant.designName,
                colorName: variant.colorName,
            });

            // consume the source pieces
            const sourceIds = lockedBySize.flat().map((item) => item.id);
            await this._stockItemRepository.markConsumed(tx, sourceIds);

            // create lineage: SET #j consumed exactly one locked piece per size, at index j
            const lineageRows = [];
            for (let j = 0; j < quantity; j++) {
                for (const lockedForSize of lockedBySize) {
                    lineageRows.push({ resultStockItemId: created[j].id, sourceStockItemId: lockedForSize[j].id });
                }
            }
            await this._stockItemLineageRepository.createMany(tx, lineageRows);

            const resultStockItemIds = created.map((item) => item.id);

            // record SET_ASSEMBLED history — same tx; consumption is the source side of this
            // one transformation event, never a separate STOCK_CONSUMED event (see stockHistory
            // event model: consuming loose pieces is a consequence of assembly, not data loss).
            // One row per transformation request, same convention STOCK_IN uses when a single
            // event spans many stock items: resultStockItemId only when there's exactly one,
            // else the full list lives in metadata.
            await this._stockHistoryService.record(tx, "SET_ASSEMBLED", {
                colorVariantId,
                stockGroupId: setGroup.id,
                resultStockItemId: quantity === 1 ? resultStockItemIds[0] : null,
                quantity,
                metadata: {
                    sourceStockItemIds: sourceIds,
                    resultStockItemIds,
                    sourceComposition: setSizes.map((size) => ({ designSizeId: size.id, quantity })),
                },
            });

            return {
                setsCreated: quantity,
                createdStockItemIds: resultStockItemIds,
                consumedStockItemIds: sourceIds,
                generatedQrs,
            };
        })
    }

    // Available loose pieces per set-required size for a variant, the maximum number of
    // complete SETs currently buildable, and every existing BUNDLE recipe (stock group) for
    // this variant with its own maximum buildable count — same figures the transformation UI
    // needs, computed from the same repositories assembleSet()/assembleBundle() themselves
    // rely on (never a parallel calculation).
    async getLooseAvailability(colorVariantId) {
        const variant = await this._colorVariantRepository.findActiveById(db, colorVariantId);
        if (!variant) {
            throw new ApiError(`Color variant ${colorVariantId} not found or inactive.`, 404, "VARIANT_NOT_FOUND");
        }

        const activeSizes = await this._designSizeRepository.findActiveByVariantId(db, colorVariantId);
        const setSizes = activeSizes.filter((size) => size.includedInSet);
        const sizeLabelById = new Map(activeSizes.map((size) => [size.id, size.sizeLabel]));

        const loosePiecesBySize = await this._stockItemRepository.countLoosePiecesBySize(db, colorVariantId);
        const loosePiecesByDesignSizeId = new Map(loosePiecesBySize.map((row) => [row.designSizeId, row.pieceCount]));

        const sizes = setSizes.map((size) => ({
            designSizeId: size.id,
            size: size.sizeLabel,
            loosePieces: loosePiecesByDesignSizeId.get(size.id) ?? 0,
        }));

        const maxSets = sizes.length === 0 ? 0 : Math.min(...sizes.map((row) => row.loosePieces));

        // A "bundle definition" here is simply an existing BUNDLE stock group for this variant
        // (see stockGroup.schema.js's uniqueness on colorVariantId + compositionSignature) —
        // there is no separate bundle-catalog table, and the transformation screen must never
        // invent a composition of its own (see assembleBundle below).
        const bundleGroups = await this._stockGroupRepository.findByColorVariantAndType(db, colorVariantId, "BUNDLE");
        const bundles = bundleGroups.map((group) => {
            // A bundle's composition can reference sizes that aren't part of a SET (includedInSet
            // filters `sizes` above) — so each piece carries its own loosePieces count rather than
            // making the frontend cross-reference against the SET-scoped `sizes` array.
            const composition = parseBundleCompositionSignature(group.compositionSignature).map((piece) => ({
                designSizeId: piece.designSizeId,
                size: sizeLabelById.get(piece.designSizeId) ?? String(piece.designSizeId),
                quantity: piece.quantity,
                loosePieces: loosePiecesByDesignSizeId.get(piece.designSizeId) ?? 0,
            }));
            const piecesPerBundle = composition.reduce((sum, piece) => sum + piece.quantity, 0);
            const maxBundles = composition.length === 0
                ? 0
                : Math.min(...composition.map((piece) => Math.floor(piece.loosePieces / piece.quantity)));

            return { stockGroupId: group.id, composition, piecesPerBundle, maxBundles };
        });

        return {
            design: { id: variant.designId, code: variant.designCode, name: variant.designName },
            variant: { id: variant.id, colorName: variant.colorName, colorHex: variant.colorHex, imageUrl: variant.imageUrl },
            sizes,
            maxSets,
            bundles,
        };
    }

    // quantity = how many bundles of this EXISTING recipe to assemble in one call. The
    // composition is never accepted from the caller — stockGroupId identifies one of this
    // variant's existing BUNDLE stock groups (see getLooseAvailability/findByColorVariantAndType
    // above), and its stored compositionSignature is the sole source of truth for how many
    // pieces of each size one bundle actually requires.
    async assembleBundle(colorVariantId, stockGroupId, quantity = 1) {
        return db.transaction(async (tx) => {
            const variant = await this._colorVariantRepository.findActiveById(tx, colorVariantId);
            if (!variant) {
                throw new ApiError(`Color variant ${colorVariantId} not found or inactive.`, 404, "VARIANT_NOT_FOUND");
            }

            const bundleGroup = await this._stockGroupRepository.findById(tx, stockGroupId);
            if (!bundleGroup || bundleGroup.type !== "BUNDLE" || bundleGroup.colorVariantId !== colorVariantId) {
                throw new ApiError(`Bundle configuration ${stockGroupId} not found for this variant.`, 404, "BUNDLE_NOT_FOUND");
            }

            const composition = parseBundleCompositionSignature(bundleGroup.compositionSignature);
            if (composition.length === 0) {
                throw new ApiError(`Bundle configuration ${stockGroupId} has no valid composition.`, 400, "INVALID_BUNDLE_COMPOSITION");
            }

            // Lock `piece.quantity * quantity` loose pieces per required size. lockedByPiece[i]
            // lines up with composition[i]; within it, the first piece.quantity items go to
            // bundle #0, the next piece.quantity to bundle #1, and so on (see lineage below).
            const lockedByPiece = [];
            const shortEntries = [];
            for (const piece of composition) {
                const needed = piece.quantity * quantity;
                const locked = await this._stockItemRepository.findAndLockAvailableBySize(tx, colorVariantId, piece.designSizeId, needed);
                if (locked.length < needed) {
                    shortEntries.push({ designSizeId: piece.designSizeId, needed, available: locked.length });
                }
                lockedByPiece.push({ piece, locked });
            }
            if (shortEntries.length > 0) {
                throw new ApiError(`Not enough loose pieces to assemble ${quantity} BUNDLE(s): ${JSON.stringify(shortEntries)}.`, 409, "INSUFFICIENT_LOOSE_PIECES");
            }

            const created = await this._stockItemRepository.createMany(tx,
                Array.from({ length: quantity }, () => ({
                    stockGroupId: bundleGroup.id,
                    colorVariantId,
                    stockInTransactionId: null,
                    bundleId: null, // not tied to any received stock_in_bundle instance — this bundle was assembled, not received
                    type: "BUNDLE",
                    status: "AVAILABLE",
                }))
            );

            const generatedQrs = await this._stockQrService.generateForStockItems(tx, created, {
                designCode: variant.designCode,
                designName: variant.designName,
                colorName: variant.colorName,
            });

            const sourceIds = lockedByPiece.flatMap(({ locked }) => locked.map((item) => item.id));
            await this._stockItemRepository.markConsumed(tx, sourceIds);

            // create lineage: bundle #j consumed exactly piece.quantity locked pieces per
            // composition entry, sliced out of that entry's locked pool at offset j*piece.quantity.
            const lineageRows = [];
            for (let j = 0; j < quantity; j++) {
                for (const { piece, locked } of lockedByPiece) {
                    const chunk = locked.slice(j * piece.quantity, (j + 1) * piece.quantity);
                    for (const item of chunk) {
                        lineageRows.push({ resultStockItemId: created[j].id, sourceStockItemId: item.id });
                    }
                }
            }
            await this._stockItemLineageRepository.createMany(tx, lineageRows);

            const resultStockItemIds = created.map((item) => item.id);

            // record BUNDLE_ASSEMBLED history — same tx; same bulk-event convention as
            // assembleSet's SET_ASSEMBLED above.
            await this._stockHistoryService.record(tx, "BUNDLE_ASSEMBLED", {
                colorVariantId,
                stockGroupId: bundleGroup.id,
                resultStockItemId: quantity === 1 ? resultStockItemIds[0] : null,
                quantity,
                metadata: {
                    sourceStockItemIds: sourceIds,
                    resultStockItemIds,
                    composition,
                },
            });

            return {
                bundlesCreated: quantity,
                createdStockItemIds: resultStockItemIds,
                consumedStockItemIds: sourceIds,
                generatedQrs,
            };
        })
    }
}

export default new StockItemService();
