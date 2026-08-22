import { db } from "../../../database/index.js";
import ApiError from "../../../core/apiError.js";

import stockAdjustmentRepository from "../repositories/stockAdjustment.repository.js";
import stockItemRepository from "../repositories/stockItem.repository.js";
import stockGroupRepository from "../repositories/stockGroup.repository.js";
import variantInventoryRepository from "../../inventory/repositories/variantInventory.repository.js";
import colorVariantRepository from "../../design/repositories/colorVariant.repository.js";
import designSizeRepository from "../../design/repositories/designSize.repository.js";
import stockInValidator from "./stockInValidator.service.js";
import stockInCalculator from "./stockInCalculator.service.js";
import stockInPersistence, { parseBundleCompositionSignature } from "./stockInPersistence.service.js";
import stockQrService from "./stockQr.service.js";
import stockHistoryService from "./stockHistory.service.js";

// No auth module yet — every adjustment is attributed to this label until real users exist.
const DEFAULT_ACTOR = "Owner";

// Stock item types a write-off can target: whole units and individually-tagged loose pieces.
// Untagged LOOSE_PIECE rows are written off by size + quantity instead (see writeOff).
const WRITE_OFF_UNIT_TYPES = new Set(["SET", "BUNDLE", "PIECE"]);

function deltaToEntries(delta) {
    return [...delta.entries()].filter(([, quantity]) => quantity > 0).map(([designSizeId, quantity]) => ({ designSizeId, quantity }));
}

function entriesToDelta(entries) {
    return new Map((entries ?? []).map((entry) => [entry.designSizeId, entry.quantity]));
}

function sumDelta(delta) {
    return [...delta.values()].reduce((sum, quantity) => sum + quantity, 0);
}

// "S:2 M:1" — stored on the adjustment so the log can show it without re-resolving sizes.
function buildSizeSummary(delta, activeSizes) {
    const labelById = new Map(activeSizes.map((size) => [size.id, size.sizeLabel]));
    return deltaToEntries(delta).map((entry) => `${labelById.get(entry.designSizeId) ?? entry.designSizeId}:${entry.quantity}`).join(" ");
}

class StockAdjustmentService {
    _repository = stockAdjustmentRepository;
    _stockItemRepository = stockItemRepository;
    _stockGroupRepository = stockGroupRepository;
    _variantInventoryRepository = variantInventoryRepository;
    _colorVariantRepository = colorVariantRepository;
    _designSizeRepository = designSizeRepository;
    _stockInValidator = stockInValidator;
    _stockInCalculator = stockInCalculator;
    _stockInPersistence = stockInPersistence;
    _stockQrService = stockQrService;
    _stockHistoryService = stockHistoryService;

    // Adds pieces outside Stock In — complete sets, semi sets, or loose pieces — as real stock
    // items with their own QR tags (sets/semi sets), exactly as Stock In would create them,
    // just without a challan/transaction.
    async addStock({ colorVariantId, kind, sets, semiSet, loosePieces, reason, note }) {
        return db.transaction(async (tx) => {
            const variant = await this._requireVariant(tx, colorVariantId);

            const variantInput = { colorVariantId, totalSetsReceived: 0, bundles: [], loosePieces: [] };
            if (kind === "SETS") variantInput.totalSetsReceived = sets;
            if (kind === "SEMI") {
                variantInput.bundles = [{
                    quantity: semiSet.count,
                    composition: semiSet.designSizeIds.map((designSizeId) => ({ designSizeId, quantity: 1 })),
                }];
            }
            if (kind === "LOOSE") variantInput.loosePieces = loosePieces.filter((piece) => piece.quantity > 0);

            const { activeSizes } = await this._stockInValidator.validate(tx, variant.designId, variantInput);

            if (kind === "SETS" && !activeSizes.some((size) => size.includedInSet)) {
                throw new ApiError("This variant has no sizes marked as part of a complete set.", 400, "NO_SET_SIZES");
            }
            if (kind === "SEMI") {
                const setSizeCount = activeSizes.filter((size) => size.includedInSet).length;
                if (semiSet.designSizeIds.length >= setSizeCount) {
                    throw new ApiError("A semi set must leave out at least one size — use Complete sets for all sizes.", 400, "SEMI_SET_IS_FULL_SET");
                }
            }

            const delta = this._stockInCalculator.calculateStockIn(activeSizes, variantInput);
            const quantity = sumDelta(delta);
            if (quantity === 0) throw new ApiError("Enter a quantity to add.", 400, "EMPTY_ADJUSTMENT");

            const setGroup = variantInput.totalSetsReceived > 0 ? await this._stockInPersistence.resolveSetGroup(tx, colorVariantId) : null;
            const bundleGroups = await this._stockInPersistence.resolveBundleGroups(tx, colorVariantId, variantInput.bundles);
            const loosePieceGroups = await this._stockInPersistence.resolveLoosePieceGroups(tx, colorVariantId, variantInput.loosePieces);

            const stockItems = await this._stockInPersistence.createStockItems(tx, {
                stockInTransactionId: null,
                colorVariantId,
                variantInput,
                setGroup,
                // No stock_in_bundles row exists outside Stock In — createStockItems only reads
                // each entry's quantity (and a nullable bundleId).
                createdBundles: variantInput.bundles.map((bundle) => ({ id: null, quantity: bundle.quantity })),
                bundleGroups,
                loosePieceGroups,
            });

            await this._stockQrService.generateForStockItems(tx, stockItems, {
                designCode: variant.designCode,
                designName: variant.designName,
                colorName: variant.colorName,
            });

            await this._applyInventoryDelta(tx, colorVariantId, delta, +1);

            const sizeDelta = deltaToEntries(delta);
            const adjustment = await this._repository.create(tx, {
                colorVariantId,
                type: "ADD",
                quantity,
                reason,
                note: note || null,
                createdBy: DEFAULT_ACTOR,
                metadata: { kind, stockItemIds: stockItems.map((item) => item.id), sizeDelta, sizeSummary: buildSizeSummary(delta, activeSizes) },
            });

            await this._stockHistoryService.record(tx, "STOCK_ADJUSTED_IN", {
                colorVariantId,
                quantity,
                metadata: { adjustmentId: adjustment.id, reason, note: note || null, sizeBreakdown: sizeDelta },
            });

            return adjustment;
        });
    }

    // Removes specific tagged units (sets, semi sets, tagged pieces) and/or a quantity of untagged
    // loose pieces per size from stock. Items are marked CONSUMED (same as a sale), and their
    // previous statuses are kept so a reversal can put them back exactly.
    async writeOff({ colorVariantId, stockItemIds, loosePieces, reason, note }) {
        return db.transaction(async (tx) => {
            const variant = await this._requireVariant(tx, colorVariantId);
            const activeSizes = await this._designSizeRepository.findActiveByVariantId(tx, variant.id);

            const uniqueIds = [...new Set(stockItemIds)];
            const lockedUnits = await this._repository.lockStockItems(tx, colorVariantId, uniqueIds);
            if (lockedUnits.length !== uniqueIds.length) {
                throw new ApiError("Some selected tags don't belong to this variant.", 400, "INVALID_STOCK_ITEMS");
            }
            for (const item of lockedUnits) {
                if (item.status === "CONSUMED") {
                    throw new ApiError(`Tag #${item.id} is no longer in stock — refresh and try again.`, 409, "STOCK_ITEM_NOT_IN_STOCK");
                }
                if (!WRITE_OFF_UNIT_TYPES.has(item.type) || (item.type === "PIECE" && item.parentStockItemId)) {
                    throw new ApiError(`Tag #${item.id} is part of a set — write off the whole set instead.`, 400, "NOT_A_STOCK_UNIT");
                }
            }

            const lockedLoose = [];
            for (const { designSizeId, quantity } of loosePieces.filter((piece) => piece.quantity > 0)) {
                const rows = await this._stockItemRepository.findAndLockAvailableBySize(tx, colorVariantId, designSizeId, quantity);
                if (rows.length < quantity) {
                    throw new ApiError(`Only ${rows.length} untagged loose piece(s) of that size are in stock.`, 409, "INSUFFICIENT_LOOSE_PIECES");
                }
                lockedLoose.push(...rows);
            }

            const items = [...lockedUnits, ...lockedLoose];
            if (items.length === 0) throw new ApiError("Select at least one tag or loose piece to write off.", 400, "EMPTY_ADJUSTMENT");

            const delta = await this._deltaForItems(tx, items, activeSizes);
            const quantity = sumDelta(delta);

            await this._stockItemRepository.markConsumed(tx, items.map((item) => item.id));
            await this._applyInventoryDelta(tx, colorVariantId, delta, -1);

            const sizeDelta = deltaToEntries(delta);
            const adjustment = await this._repository.create(tx, {
                colorVariantId,
                type: "REMOVE",
                quantity,
                reason,
                note: note || null,
                createdBy: DEFAULT_ACTOR,
                metadata: {
                    stockItemIds: items.map((item) => item.id),
                    previousStatuses: Object.fromEntries(items.map((item) => [item.id, item.status])),
                    sizeDelta,
                    sizeSummary: buildSizeSummary(delta, activeSizes),
                },
            });

            await this._stockHistoryService.record(tx, "STOCK_ADJUSTED_OUT", {
                colorVariantId,
                quantity,
                metadata: { adjustmentId: adjustment.id, reason, note: note || null, sizeBreakdown: sizeDelta, stockItemIds: items.map((item) => item.id) },
            });

            return adjustment;
        });
    }

    async setLowStockLevel(colorVariantId, lowStockLevel) {
        return db.transaction(async (tx) => {
            const variant = await this._requireVariant(tx, colorVariantId);
            if (variant.lowStockLevel === lowStockLevel) {
                throw new ApiError("Low-stock level is unchanged.", 400, "LEVEL_UNCHANGED");
            }

            await this._repository.updateLowStockLevel(tx, colorVariantId, lowStockLevel);
            return this._repository.create(tx, {
                colorVariantId,
                type: "LEVEL",
                reason: "Low-stock level changed",
                fromLevel: variant.lowStockLevel,
                toLevel: lowStockLevel,
                createdBy: DEFAULT_ACTOR,
            });
        });
    }

    // Undoes an ADD, REMOVE or LEVEL entry and records a REVERSE entry pointing at it.
    async reverse(adjustmentId, { note }) {
        return db.transaction(async (tx) => {
            const target = await this._repository.findByIdForUpdate(tx, adjustmentId);
            if (!target) throw new ApiError("Adjustment not found.", 404, "NOT_FOUND");
            if (target.type === "REVERSE") throw new ApiError("A reversal can't itself be reversed.", 400, "CANNOT_REVERSE_REVERSAL");
            if (target.reversedAt) throw new ApiError("This entry has already been reversed.", 409, "ALREADY_REVERSED");

            const variant = await this._requireVariant(tx, target.colorVariantId);
            const delta = entriesToDelta(target.metadata?.sizeDelta);
            const stockItemIds = target.metadata?.stockItemIds ?? [];

            if (target.type === "ADD") {
                const items = await this._repository.lockStockItems(tx, variant.id, stockItemIds);
                const gone = items.filter((item) => item.status === "CONSUMED").length + (stockItemIds.length - items.length);
                if (gone > 0) {
                    throw new ApiError(
                        `${gone} of ${stockItemIds.length} item(s) from this entry were already sold or written off, so it can't be reversed. Write off the remaining pieces instead.`,
                        409,
                        "ADJUSTMENT_ITEMS_MOVED",
                    );
                }
                await this._stockItemRepository.markConsumed(tx, stockItemIds);
                await this._applyInventoryDelta(tx, variant.id, delta, -1);
                await this._stockHistoryService.record(tx, "STOCK_ADJUSTED_OUT", {
                    colorVariantId: variant.id,
                    quantity: target.quantity,
                    metadata: { adjustmentId: target.id, reversalOf: target.id, reason: "Reversal", note, sizeBreakdown: target.metadata?.sizeDelta ?? [] },
                });
            } else if (target.type === "REMOVE") {
                const items = await this._repository.lockStockItems(tx, variant.id, stockItemIds);
                if (items.length !== stockItemIds.length || items.some((item) => item.status !== "CONSUMED")) {
                    throw new ApiError("The written-off items have changed since, so this entry can't be reversed.", 409, "ADJUSTMENT_ITEMS_MOVED");
                }
                await this._repository.restoreStatuses(tx, target.metadata?.previousStatuses ?? {});
                await this._applyInventoryDelta(tx, variant.id, delta, +1);
                await this._stockHistoryService.record(tx, "STOCK_ADJUSTED_IN", {
                    colorVariantId: variant.id,
                    quantity: target.quantity,
                    metadata: { adjustmentId: target.id, reversalOf: target.id, reason: "Reversal", note, sizeBreakdown: target.metadata?.sizeDelta ?? [] },
                });
            } else if (target.type === "LEVEL") {
                await this._repository.updateLowStockLevel(tx, variant.id, target.fromLevel);
            }

            await this._repository.markReversed(tx, target.id);
            return this._repository.create(tx, {
                colorVariantId: variant.id,
                type: "REVERSE",
                reason: "Reversal",
                note,
                targetAdjustmentId: target.id,
                createdBy: DEFAULT_ACTOR,
            });
        });
    }

    // Locks the variant row (so concurrent level changes/adjustments serialise) and returns it with
    // the design code/name the QR payloads need.
    async _requireVariant(tx, colorVariantId) {
        const locked = await this._repository.lockVariant(tx, colorVariantId);
        if (!locked) throw new ApiError(`Color variant ${colorVariantId} not found or inactive.`, 404, "VARIANT_NOT_FOUND");
        const withDesign = await this._colorVariantRepository.findActiveById(tx, colorVariantId);
        return { ...withDesign, lowStockLevel: locked.lowStockLevel };
    }

    // Per-size pieces represented by a list of stock items: SET → every included-in-set size,
    // BUNDLE → its group's composition, PIECE/LOOSE_PIECE → its own size.
    async _deltaForItems(tx, items, activeSizes) {
        const delta = new Map();
        const add = (designSizeId, quantity) => delta.set(designSizeId, (delta.get(designSizeId) ?? 0) + quantity);

        const bundleGroupIds = [...new Set(items.filter((item) => item.type === "BUNDLE").map((item) => item.stockGroupId))];
        const groups = await this._stockGroupRepository.findByIds(tx, bundleGroupIds);
        const compositionByGroupId = new Map(groups.map((group) => [group.id, parseBundleCompositionSignature(group.compositionSignature)]));
        const setSizes = activeSizes.filter((size) => size.includedInSet);

        for (const item of items) {
            if (item.type === "SET") setSizes.forEach((size) => add(size.id, 1));
            else if (item.type === "BUNDLE") (compositionByGroupId.get(item.stockGroupId) ?? []).forEach((piece) => add(piece.designSizeId, piece.quantity));
            else if (item.designSizeId) add(item.designSizeId, 1);
        }
        return delta;
    }

    // sign +1 adds the delta to variant_inventory, -1 removes it — and refuses to leave any size
    // below zero, which would mean stock_items and variant_inventory had already drifted apart.
    async _applyInventoryDelta(tx, colorVariantId, delta, sign) {
        const rows = sign > 0
            ? this._variantInventoryRepository.buildIncrementRows(colorVariantId, delta)
            : this._variantInventoryRepository.buildDecrementRows(colorVariantId, delta);
        if (rows.length === 0) return;

        const updated = await this._variantInventoryRepository.upsertIncrement(tx, rows);
        if (updated.some((row) => row.quantity < 0)) {
            throw new ApiError("This change would take a size's stock below zero — the stock count needs checking first.", 409, "NEGATIVE_INVENTORY");
        }
    }
}

export default new StockAdjustmentService();
