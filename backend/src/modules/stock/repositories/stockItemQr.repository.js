import { and, desc, eq, gte, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";

import { stockItemQr } from "../schemas/stockItemQr.schema.js";
import { stockItem } from "../schemas/stockItems.schema.js";
import { design } from "../../design/schemas/design.schema.js";
import { colorVariant } from "../../design/schemas/colorVariant.schema.js";
import { designSize } from "../../design/schemas/designSize.schema.js";
import { rack } from "../schemas/rack.schema.js";
import { bin } from "../schemas/bin.schema.js";
import { stockInTransaction } from "../schemas/stockInTransaction.schema.js";
import { stockInBundlePiece } from "../schemas/stockInBundlePiece.schema.js";
import { parseDisplayCode } from "../utils/qrDisplayCode.util.js";

// Same shape as variantCodeOf() in qrDisplayCode.util.js, as SQL, so the search box can match
// the readable id ("KP100-MID") a worker reads off a label.
const variantCodeSql = sql`(${design.code} || '-' || upper(left(regexp_replace(${colorVariant.colorName}, '\\s+', '', 'g'), 3)))`;

// The free-text search clause. A full readable id ("SET-KP100-MID-007", "KP100-MID-0012") is
// matched exactly on colour code + serial; anything else matches loosely, including a partial
// colour code like "kp100-mid".
function keywordCondition(keyword) {
    const loose = [
        ilike(stockItemQr.shortCode, `%${keyword}%`),
        ilike(design.code, `%${keyword}%`),
        ilike(colorVariant.colorName, `%${keyword}%`),
        ilike(stockInTransaction.challanNo, `%${keyword}%`),
        ilike(variantCodeSql, `%${keyword}%`),
    ];
    const parsed = parseDisplayCode(keyword);
    if (parsed) {
        loose.push(and(
            eq(stockItem.serialNo, parsed.serialNo),
            inArray(stockItem.type, parsed.types),
            sql`upper(${variantCodeSql}) = ${parsed.variantCode}`,
        ));
    }
    return or(...loose);
}

class StockItemQrRepository {
    async createMany(tx, rows) {
        if (rows.length === 0) return [];

        return tx.insert(stockItemQr).values(rows).returning();
    }

    async create(tx, row) {
        const [result] = await tx.insert(stockItemQr).values(row).returning();
        return result;
    }

    // Resolver's entry point: every history row sharing this shortCode, newest first — the
    // Resolver itself decides SET/PIECE/DUPLICATE/RETIRED/UNKNOWN from the shape of what comes
    // back (see qrCenter.service.js#resolve), never a separate query per outcome.
    async findByShortCode(tx, shortCode) {
        return tx.select().from(stockItemQr)
            .where(eq(stockItemQr.shortCode, shortCode))
            .orderBy(desc(stockItemQr.generatedAt));
    }

    // Collision check for a freshly generated shortCode — deliberately scoped to ACTIVE rows
    // only (see stockItemQr.schema.js: shortCode is not unique by design; a RETIRED code is
    // allowed to be reused going forward, only a currently-live one must not collide).
    async existsActiveShortCode(tx, shortCode) {
        const [result] = await tx.select({ id: stockItemQr.id }).from(stockItemQr)
            .where(and(eq(stockItemQr.shortCode, shortCode), eq(stockItemQr.status, "ACTIVE")))
            .limit(1);
        return Boolean(result);
    }

    // Batch form of existsActiveShortCode: which of these codes are already live.
    async findActiveShortCodes(tx, shortCodes) {
        if (shortCodes.length === 0) return [];
        const rows = await tx.select({ shortCode: stockItemQr.shortCode }).from(stockItemQr)
            .where(and(inArray(stockItemQr.shortCode, shortCodes), eq(stockItemQr.status, "ACTIVE")));
        return rows.map((row) => row.shortCode);
    }

    async findLatestActiveByStockItemId(tx, stockItemId) {
        const [result] = await tx.select().from(stockItemQr)
            .where(and(eq(stockItemQr.stockItemId, stockItemId), eq(stockItemQr.status, "ACTIVE")))
            .orderBy(desc(stockItemQr.generatedAt))
            .limit(1);
        return result;
    }

    // Retires every currently-ACTIVE row for this stock item (see stockItemQr.schema.js — a
    // reprint can leave more than one ACTIVE row behind, so Break Set / Void must not assume
    // there's exactly one to flip).
    async retireActiveByStockItemId(tx, stockItemId, { retiredReason }) {
        return tx.update(stockItemQr)
            .set({ status: "RETIRED", retiredAt: new Date(), retiredReason })
            .where(and(eq(stockItemQr.stockItemId, stockItemId), eq(stockItemQr.status, "ACTIVE")))
            .returning();
    }

    async retireByIds(tx, ids, { retiredReason }) {
        if (ids.length === 0) return [];
        return tx.update(stockItemQr)
            .set({ status: "RETIRED", retiredAt: new Date(), retiredReason })
            .where(inArray(stockItemQr.id, ids))
            .returning();
    }

    // Stale queue: active rows for a design whose snapshotted price no longer matches the
    // design's current selling price and haven't been explicitly accepted — see
    // stockItemQr.schema.js's priceSnapshot/priceAcceptedAt comments. `design.defaultSellingPricePerPiece`
    // is a plain integer column, cast to numeric so the comparison against the numeric
    // priceSnapshot column is exact rather than relying on implicit coercion.
    async findStaleByDesign(tx, designId, { onHandOnly } = {}) {
        const conditions = [
            eq(design.id, designId),
            eq(stockItemQr.status, "ACTIVE"),
            isNull(stockItemQr.priceAcceptedAt),
            ne(stockItemQr.priceSnapshot, sql`${design.defaultSellingPricePerPiece}::numeric`),
        ];
        if (onHandOnly) conditions.push(ne(stockItem.status, "CONSUMED"));

        return tx.select({
            id: stockItemQr.id,
            stockItemId: stockItemQr.stockItemId,
            shortCode: stockItemQr.shortCode,
            payload: stockItemQr.payload,
            priceSnapshot: stockItemQr.priceSnapshot,
        }).from(stockItemQr)
            .innerJoin(stockItem, eq(stockItemQr.stockItemId, stockItem.id))
            .innerJoin(colorVariant, eq(stockItem.colorVariantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .where(and(...conditions));
    }

    // Rebag-rack bulk generator: every currently ACTIVE label for stock physically assigned to
    // this rack, reprinted as-is (same "new row, same shortCode" mechanics as a single reprint —
    // see reprints/bulk-print in qrCenter.service.js).
    async findActiveByRackId(tx, rackId) {
        return tx.select({
            id: stockItemQr.id,
            stockItemId: stockItemQr.stockItemId,
            payload: stockItemQr.payload,
            shortCode: stockItemQr.shortCode,
            priceSnapshot: stockItemQr.priceSnapshot,
        }).from(stockItemQr)
            .innerJoin(stockItem, eq(stockItemQr.stockItemId, stockItem.id))
            .where(and(eq(stockItem.rackId, rackId), eq(stockItemQr.status, "ACTIVE")));
    }

    // Stale summary grouped by design — currentPrice/staleCount/onHandCount for
    // GET /qr-center/stale.
    async findStaleSummaryByDesign(tx) {
        const staleCondition = and(
            eq(stockItemQr.status, "ACTIVE"),
            isNull(stockItemQr.priceAcceptedAt),
            ne(stockItemQr.priceSnapshot, sql`${design.defaultSellingPricePerPiece}::numeric`),
        );

        return tx.select({
            designId: design.id,
            designCode: design.code,
            currentPrice: sql`${design.defaultSellingPricePerPiece}::numeric(10,2)`,
            staleCount: sql`count(distinct ${stockItemQr.id}) filter (where ${staleCondition})`.mapWith(Number),
            onHandCount: sql`count(distinct ${stockItemQr.id}) filter (where ${staleCondition} and ${stockItem.status} != 'CONSUMED')`.mapWith(Number),
        }).from(stockItemQr)
            .innerJoin(stockItem, eq(stockItemQr.stockItemId, stockItem.id))
            .innerJoin(colorVariant, eq(stockItem.colorVariantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .where(eq(stockItemQr.status, "ACTIVE"))
            .groupBy(design.id, design.code)
            .having(sql`count(distinct ${stockItemQr.id}) filter (where ${staleCondition}) > 0`);
    }

    async acceptStaleByDesign(tx, designId) {
        const staleRows = await this.findStaleByDesign(tx, designId, { onHandOnly: false });
        const ids = staleRows.map((row) => row.id);
        if (ids.length === 0) return 0;

        const updated = await tx.update(stockItemQr)
            .set({ priceAcceptedAt: new Date() })
            .where(inArray(stockItemQr.id, ids))
            .returning({ id: stockItemQr.id });

        return updated.length;
    }

    // Duplicate-suspect count for the health widget: how many distinct shortCodes currently
    // resolve to more than one distinct stock item (the Resolver's DUPLICATE condition).
    async countDuplicateSuspects(tx) {
        const grouped = tx.select({ shortCode: stockItemQr.shortCode })
            .from(stockItemQr)
            .where(eq(stockItemQr.status, "ACTIVE"))
            .groupBy(stockItemQr.shortCode)
            .having(sql`count(distinct ${stockItemQr.stockItemId}) > 1`)
            .as("duplicate_suspects");

        const [result] = await tx.select({ value: sql`count(*)`.mapWith(Number) }).from(grouped);
        return result.value;
    }

    // Ordered newest-first so callers picking "the" QR for a stock item (there can be
    // several history rows — see stockItemQr.schema.js) just take the first match per id.
    async findByStockItemIds(tx, stockItemIds) {
        if (stockItemIds.length === 0) return [];

        return tx.select().from(stockItemQr)
            .where(inArray(stockItemQr.stockItemId, stockItemIds))
            .orderBy(desc(stockItemQr.generatedAt));
    }

    // Every QR generated as part of one Stock Registration (stock_in_transaction), for the
    // QR Grid page — joined back to stock_item only for its `type`, which the grid label
    // needs. Newest-first for the same reason as findByStockItemIds: a caller collapsing to
    // one QR per stock item just takes the first match.
    async findByStockInTransactionId(tx, stockInTransactionId) {
        const parentStockItemIds = tx.select({ id: stockItem.id })
            .from(stockItem)
            .where(eq(stockItem.stockInTransactionId, stockInTransactionId));

        return tx.select({
            id: stockItemQr.id,
            stockItemId: stockItemQr.stockItemId,
            payload: stockItemQr.payload,
            shortCode: stockItemQr.shortCode,
            priceSnapshot: stockItemQr.priceSnapshot,
            generatedAt: stockItemQr.generatedAt,
            type: stockItem.type,
            designSizeLabel: designSize.sizeLabel,
            parentStockItemId: stockItem.parentStockItemId,
        }).from(stockItemQr)
            .innerJoin(stockItem, eq(stockItemQr.stockItemId, stockItem.id))
            .leftJoin(designSize, eq(stockItem.designSizeId, designSize.id))
            .where(or(
                eq(stockItem.stockInTransactionId, stockInTransactionId),
                inArray(stockItem.originSetStockItemId, parentStockItemIds),
            ))
            .orderBy(desc(stockItemQr.generatedAt));
    }

    // QR Center's main search box: every ACTIVE tag matching a free-text keyword and/or the
    // design/variant/type/age filters — the multi-result counterpart to findByShortCode's
    // single-code lookup. Joined out to inward batch info (stockInTransaction) since the
    // reference search results show challan/inward date alongside each tag.
    async searchActive(tx, { keyword, designId, colorVariantId, type, days, limit, offset }) {
        const conditions = [eq(stockItemQr.status, "ACTIVE")];
        if (keyword) conditions.push(keywordCondition(keyword));
        if (designId) conditions.push(eq(design.id, designId));
        if (colorVariantId) conditions.push(eq(colorVariant.id, colorVariantId));
        if (type) conditions.push(eq(stockItem.type, type));
        if (days) conditions.push(gte(stockItemQr.generatedAt, sql`now() - (${days} || ' days')::interval`));

        return tx.select({
            id: stockItemQr.id,
            stockItemId: stockItemQr.stockItemId,
            shortCode: stockItemQr.shortCode,
            generatedAt: stockItemQr.generatedAt,
            type: stockItem.type,
            serialNo: stockItem.serialNo,
            isChildPiece: sql`${stockItem.originSetStockItemId} is not null`.mapWith(Boolean),
            // A bundle with fewer pieces than a full set is a "semi set" (see QrBatchService).
            isSemi: sql`(${stockItem.type} = 'BUNDLE'
                and coalesce((select sum(${stockInBundlePiece.quantity}) from ${stockInBundlePiece} where ${stockInBundlePiece.bundleId} = ${stockItem.bundleId}), 0) > 0
                and coalesce((select sum(${stockInBundlePiece.quantity}) from ${stockInBundlePiece} where ${stockInBundlePiece.bundleId} = ${stockItem.bundleId}), 0)
                  < (select count(*) from ${designSize} ds where ds.variant_id = ${colorVariant.id} and ds.included_in_set))`.mapWith(Boolean),
            rackId: stockItem.rackId,
            rackCode: rack.code,
            binId: stockItem.binId,
            binCode: bin.code,
            designId: design.id,
            designCode: design.code,
            designName: design.name,
            colorVariantId: colorVariant.id,
            colorName: colorVariant.colorName,
            colorHex: colorVariant.colorHex,
            sizeLabel: designSize.sizeLabel,
            challanNo: stockInTransaction.challanNo,
            stockDate: stockInTransaction.stockDate,
        }).from(stockItemQr)
            .innerJoin(stockItem, eq(stockItem.id, stockItemQr.stockItemId))
            .innerJoin(colorVariant, eq(colorVariant.id, stockItem.colorVariantId))
            .innerJoin(design, eq(design.id, colorVariant.designId))
            .leftJoin(designSize, eq(designSize.id, stockItem.designSizeId))
            .leftJoin(rack, eq(rack.id, stockItem.rackId))
            .leftJoin(bin, eq(bin.id, stockItem.binId))
            .leftJoin(stockInTransaction, eq(stockInTransaction.id, stockItem.stockInTransactionId))
            .where(and(...conditions))
            .orderBy(desc(stockItemQr.generatedAt))
            .limit(limit)
            .offset(offset);
    }

    async countActive(tx, { keyword, designId, colorVariantId, type, days }) {
        const conditions = [eq(stockItemQr.status, "ACTIVE")];
        if (keyword) conditions.push(keywordCondition(keyword));
        if (designId) conditions.push(eq(design.id, designId));
        if (colorVariantId) conditions.push(eq(colorVariant.id, colorVariantId));
        if (type) conditions.push(eq(stockItem.type, type));
        if (days) conditions.push(gte(stockItemQr.generatedAt, sql`now() - (${days} || ' days')::interval`));

        const [result] = await tx.select({ value: sql`count(*)`.mapWith(Number) }).from(stockItemQr)
            .innerJoin(stockItem, eq(stockItem.id, stockItemQr.stockItemId))
            .innerJoin(colorVariant, eq(colorVariant.id, stockItem.colorVariantId))
            .innerJoin(design, eq(design.id, colorVariant.designId))
            .leftJoin(stockInTransaction, eq(stockInTransaction.id, stockItem.stockInTransactionId))
            .where(and(...conditions));

        return result.value;
    }
}

export default new StockItemQrRepository();
