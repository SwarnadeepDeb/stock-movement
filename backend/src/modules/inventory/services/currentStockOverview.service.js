import { db } from "../../../database/index.js";
import ApiError from "../../../core/apiError.js";

import currentStockOverviewRepository from "../repositories/currentStockOverview.repository.js";
import stockGroupRepository from "../../stock/repositories/stockGroup.repository.js";
import { parseBundleCompositionSignature } from "../../stock/services/stockInPersistence.service.js";

// A variant is "ageing" once its oldest piece still in stock arrived this many days ago.
export const AGEING_DAYS = 60;
const MOVEMENT_LIMIT = 60;
const ADJUSTMENT_LIMIT = 300;

// "YYYY-MM-DD" for the server's own local calendar day.
function todayIsoDate() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// Whole days between two "YYYY-MM-DD" dates, parsed as UTC dates so no timezone shift applies.
function daysBetween(fromIsoDate, toIsoDate) {
    if (!fromIsoDate) return null;
    const [fy, fm, fd] = fromIsoDate.slice(0, 10).split("-").map(Number);
    const [ty, tm, td] = toIsoDate.split("-").map(Number);
    return Math.max(0, Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000));
}

function groupBy(rows, key) {
    const map = new Map();
    for (const row of rows) {
        const k = row[key];
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(row);
    }
    return map;
}

function minDate(dates) {
    return dates.filter(Boolean).sort()[0] ?? null;
}

class CurrentStockOverviewService {
    _repository = currentStockOverviewRepository;
    _stockGroupRepository = stockGroupRepository;

    // Every active variant's current stock, in one response — the page filters, sorts, groups
    // by design and derives its header stats/alerts from this list client-side.
    async getOverview() {
        const variants = await this._buildVariantRows(db);
        return { ageingDays: AGEING_DAYS, asOn: todayIsoDate(), variants };
    }

    // One variant's full picture for the drawer: summary, tags in stock, movement history.
    async getVariantDetail(colorVariantId) {
        const [summary] = await this._buildVariantRows(db, { colorVariantId });
        if (!summary) throw new ApiError(`Color variant ${colorVariantId} not found or inactive.`, 404, "VARIANT_NOT_FOUND");

        const today = todayIsoDate();
        const sizeLabelById = new Map(summary.sizes.map((size) => [size.designSizeId, size.size]));
        const setSizeLabels = summary.sizes.filter((size) => size.includedInSet).map((size) => size.size);

        const [unitRows, historyRows, adjustmentRows] = await Promise.all([
            this._repository.findUnitsForVariant(db, colorVariantId),
            this._repository.findHistoryForVariant(db, colorVariantId, { limit: MOVEMENT_LIMIT }),
            this._repository.findAdjustments(db, { colorVariantId, limit: MOVEMENT_LIMIT }),
        ]);

        const bundleGroupIds = [...new Set(unitRows.filter((row) => row.type === "BUNDLE").map((row) => row.stockGroupId))];
        const bundleGroups = await this._stockGroupRepository.findByIds(db, bundleGroupIds);
        const compositionByGroupId = new Map(bundleGroups.map((group) => [group.id, parseBundleCompositionSignature(group.compositionSignature)]));

        const parentRows = unitRows.filter((row) => row.type === "SET" || row.type === "BUNDLE");
        const childRows = await this._repository.findChildTags(db, parentRows.map((row) => row.stockItemId));
        const childrenByParentId = groupBy(childRows, "parentId");

        const units = [];
        const looseBySize = new Map();

        for (const row of unitRows) {
            const ageDays = daysBetween(row.receivedOn, today);

            if (row.type === "SET" || row.type === "BUNDLE") {
                const sizes = row.type === "SET"
                    ? setSizeLabels
                    : (compositionByGroupId.get(row.stockGroupId) ?? []).flatMap((piece) =>
                        Array(piece.quantity).fill(sizeLabelById.get(piece.designSizeId) ?? String(piece.designSizeId)));

                units.push({
                    stockItemId: row.stockItemId,
                    kind: row.type === "SET" ? "SET" : "SEMI",
                    shortCode: row.shortCode,
                    sizes,
                    pieceCount: sizes.length,
                    receivedOn: row.receivedOn,
                    ageDays,
                    challanNo: row.challanNo,
                    children: (childrenByParentId.get(row.stockItemId) ?? []).map((child) => ({
                        stockItemId: child.stockItemId,
                        shortCode: child.shortCode,
                        size: sizeLabelById.get(child.designSizeId) ?? null,
                    })),
                });
            } else if (row.type === "PIECE") {
                units.push({
                    stockItemId: row.stockItemId,
                    kind: "TAGGED_PIECE",
                    shortCode: row.shortCode,
                    sizes: [row.designSizeId ? (sizeLabelById.get(row.designSizeId) ?? String(row.designSizeId)) : "—"],
                    pieceCount: 1,
                    receivedOn: row.receivedOn,
                    ageDays,
                    challanNo: row.challanNo,
                    children: [],
                });
            } else {
                // Untagged LOOSE_PIECE rows are interchangeable — shown as one row per size.
                const group = looseBySize.get(row.designSizeId) ?? {
                    designSizeId: row.designSizeId,
                    size: sizeLabelById.get(row.designSizeId) ?? String(row.designSizeId),
                    quantity: 0,
                    oldestReceivedOn: null,
                };
                group.quantity += 1;
                group.oldestReceivedOn = minDate([group.oldestReceivedOn, row.receivedOn]);
                looseBySize.set(row.designSizeId, group);
            }
        }

        const sizeOrder = new Map(summary.sizes.map((size, index) => [size.designSizeId, index]));
        const looseGroups = [...looseBySize.values()]
            .map((group) => ({ ...group, ageDays: daysBetween(group.oldestReceivedOn, today) }))
            .sort((a, b) => (sizeOrder.get(a.designSizeId) ?? 99) - (sizeOrder.get(b.designSizeId) ?? 99));

        return {
            variant: summary,
            units,
            looseGroups,
            movements: this._buildMovements(historyRows, adjustmentRows),
        };
    }

    // Current stock of the given variants (same counting rules as the Current Stock page) —
    // used by Design Master's edit to refuse removing a size/variant that still has stock.
    // `runner` may be an open transaction.
    async getVariantsStock(runner, colorVariantIds) {
        if (colorVariantIds.length === 0) return new Map();
        // One batched pass for every variant — the database is remote, so round trips dominate.
        const rows = await this._buildVariantRows(runner, { colorVariantIds });
        return new Map(rows.map((row) => [row.colorVariantId, row]));
    }

    async listAdjustments() {
        const rows = await this._repository.findAdjustments(db, { limit: ADJUSTMENT_LIMIT });
        return rows.map((row) => ({
            id: row.id,
            type: row.type,
            quantity: row.quantity,
            reason: row.reason,
            note: row.note,
            fromLevel: row.fromLevel,
            toLevel: row.toLevel,
            targetAdjustmentId: row.targetAdjustmentId,
            reversedAt: row.reversedAt,
            sizeSummary: row.metadata?.sizeSummary ?? null,
            createdBy: row.createdBy,
            createdAt: row.createdAt,
            design: { id: row.designId, code: row.designCode, name: row.designName },
            variant: { id: row.colorVariantId, colorName: row.colorName, colorHex: row.colorHex },
        }));
    }

    async resolveTag(shortCode) {
        const result = await this._repository.findVariantByShortCode(db, shortCode.trim());
        if (!result) throw new ApiError(`No active tag "${shortCode}" found.`, 404, "TAG_NOT_FOUND");
        return result;
    }

    async _buildVariantRows(runner, { colorVariantId, colorVariantIds } = {}) {
        const variants = await this._repository.findActiveVariants(runner, { colorVariantId, colorVariantIds });
        const variantIds = variants.map((variant) => variant.colorVariantId);

        const [sizeRows, inventoryRows, unitRows] = await Promise.all([
            this._repository.findActiveSizes(runner, variantIds),
            this._repository.findInventory(runner, variantIds),
            this._repository.countUnits(runner, variantIds),
        ]);

        const bundleGroupIds = [...new Set(unitRows.filter((row) => row.type === "BUNDLE").map((row) => row.stockGroupId))];
        const bundleGroups = await this._stockGroupRepository.findByIds(runner, bundleGroupIds);
        const compositionByGroupId = new Map(bundleGroups.map((group) => [group.id, parseBundleCompositionSignature(group.compositionSignature)]));

        const sizesByVariant = groupBy(sizeRows, "variantId");
        const inventoryByVariant = groupBy(inventoryRows, "colorVariantId");
        const unitsByVariant = groupBy(unitRows, "colorVariantId");
        const today = todayIsoDate();

        return variants.map((variant) => {
            const sizes = sizesByVariant.get(variant.colorVariantId) ?? [];
            const inventory = inventoryByVariant.get(variant.colorVariantId) ?? [];
            const units = unitsByVariant.get(variant.colorVariantId) ?? [];

            // Pieces are counted from the stock items themselves — the physical units Stock Out
            // and write-offs actually consume — exploded per size: a SET gives one piece to every
            // included-in-set size, a BUNDLE (semi set) its composition, a loose piece its size.
            const setSizes = sizes.filter((size) => size.includedInSet);
            const quantityBySizeId = new Map();
            const add = (designSizeId, quantity) => quantityBySizeId.set(designSizeId, (quantityBySizeId.get(designSizeId) ?? 0) + quantity);

            let sets = 0;
            let semiSets = 0;
            let semiPieces = 0;
            let loosePieces = 0;
            for (const row of units) {
                if (row.type === "SET") {
                    sets += row.unitCount;
                    setSizes.forEach((size) => add(size.id, row.unitCount));
                } else if (row.type === "BUNDLE") {
                    semiSets += row.unitCount;
                    for (const piece of compositionByGroupId.get(row.stockGroupId) ?? []) {
                        add(piece.designSizeId, piece.quantity * row.unitCount);
                        semiPieces += piece.quantity * row.unitCount;
                    }
                } else {
                    loosePieces += row.unitCount;
                    if (row.designSizeId) add(row.designSizeId, row.unitCount);
                }
            }
            const totalPieces = sets * setSizes.length + semiPieces + loosePieces;

            // variant_inventory is the running ledger Stock In/Out/adjustments maintain alongside
            // the items. It should always agree — when it doesn't, say so instead of hiding it.
            const ledgerPieces = inventory.reduce((sum, row) => sum + row.quantity, 0);
            const ledgerBySizeId = new Map(inventory.map((row) => [row.designSizeId, row.quantity]));
            const ledgerMatches = ledgerPieces === totalPieces
                && [...new Set([...ledgerBySizeId.keys(), ...quantityBySizeId.keys()])]
                    .every((id) => (ledgerBySizeId.get(id) ?? 0) === (quantityBySizeId.get(id) ?? 0));

            const oldestReceivedOn = totalPieces > 0 ? minDate(units.map((row) => row.oldestReceivedOn)) : null;
            const oldestDays = daysBetween(oldestReceivedOn, today);
            const price = Number(variant.sellingPricePerPiece) || 0;

            let status = "IN_STOCK";
            if (totalPieces === 0) status = "OUT_OF_STOCK";
            else if (totalPieces <= variant.lowStockLevel) status = "LOW";

            return {
                colorVariantId: variant.colorVariantId,
                colorName: variant.colorName,
                colorHex: variant.colorHex,
                imageUrl: variant.imageUrl,
                design: {
                    id: variant.designId,
                    code: variant.designCode,
                    name: variant.designName,
                    sellingPricePerPiece: price,
                },
                sizes: sizes.map((size) => ({
                    designSizeId: size.id,
                    size: size.sizeLabel,
                    includedInSet: size.includedInSet,
                    quantity: quantityBySizeId.get(size.id) ?? 0,
                })),
                totalPieces,
                sets,
                semiSets,
                loosePieces,
                value: totalPieces * price,
                oldestReceivedOn,
                oldestDays,
                isAgeing: totalPieces > 0 && oldestDays !== null && oldestDays >= AGEING_DAYS,
                lowStockLevel: variant.lowStockLevel,
                status,
                ledgerPieces,
                ledgerMatches,
            };
        });
    }

    // stock_history events + LEVEL changes (which don't move stock, so aren't history events),
    // newest first, in one display-ready shape.
    _buildMovements(historyRows, adjustmentRows) {
        const reversedAdjustmentIds = new Set(adjustmentRows.filter((row) => row.reversedAt).map((row) => row.id));

        const fromHistory = historyRows.map((row) => {
            const adjustmentId = row.metadata?.adjustmentId ?? null;
            const base = { at: row.createdAt, quantity: row.quantity, adjustmentId, reversed: adjustmentId ? reversedAdjustmentIds.has(adjustmentId) : false };
            switch (row.eventType) {
                case "STOCK_IN":
                    return { ...base, direction: "IN", title: "Stock in", reference: row.challanNo ? `Challan ${row.challanNo}` : null };
                case "STOCK_OUT":
                    return { ...base, direction: "OUT", title: "Sold", reference: row.stockOutNotes || null };
                case "STOCK_ADJUSTED_IN":
                    return { ...base, direction: "IN", title: row.metadata?.reversalOf ? "Write-off reversed" : `Stock added · ${row.metadata?.reason ?? "Adjustment"}`, reference: row.metadata?.note ?? null };
                case "STOCK_ADJUSTED_OUT":
                    return { ...base, direction: "OUT", title: row.metadata?.reversalOf ? "Stock addition reversed" : `Written off · ${row.metadata?.reason ?? "Adjustment"}`, reference: row.metadata?.note ?? null };
                case "SET_ASSEMBLED":
                    return { ...base, direction: "NEUTRAL", title: `${row.quantity} set${row.quantity === 1 ? "" : "s"} assembled from loose pieces`, reference: null, quantity: null };
                case "BUNDLE_ASSEMBLED":
                    return { ...base, direction: "NEUTRAL", title: `${row.quantity} semi set${row.quantity === 1 ? "" : "s"} assembled`, reference: null, quantity: null };
                case "SET_BROKEN":
                    return { ...base, direction: "NEUTRAL", title: "Set broken into pieces", reference: null, quantity: null };
                default:
                    return { ...base, direction: "NEUTRAL", title: row.eventType, reference: null };
            }
        });

        const fromLevels = adjustmentRows.filter((row) => row.type === "LEVEL").map((row) => ({
            at: row.createdAt,
            quantity: null,
            direction: "NEUTRAL",
            title: `Low-stock level ${row.fromLevel} → ${row.toLevel}`,
            reference: null,
            adjustmentId: row.id,
            reversed: Boolean(row.reversedAt),
        }));

        return [...fromHistory, ...fromLevels]
            .sort((a, b) => new Date(b.at) - new Date(a.at))
            .slice(0, MOVEMENT_LIMIT);
    }
}

export default new CurrentStockOverviewService();
