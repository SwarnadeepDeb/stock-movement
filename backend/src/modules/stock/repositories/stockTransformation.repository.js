import { aliasedTable, and, asc, desc, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";

import { stockTransformation } from "../schemas/stockTransformation.schema.js";
import { stockItem } from "../schemas/stockItems.schema.js";
import { stockItemQr } from "../schemas/stockItemQr.schema.js";
import { stockItemLineage } from "../schemas/stockItemLineage.schema.js";
import { stockInTransaction } from "../schemas/stockInTransaction.schema.js";
import { colorVariant } from "../../design/schemas/colorVariant.schema.js";
import { design } from "../../design/schemas/design.schema.js";
import { designSize } from "../../design/schemas/designSize.schema.js";

// The set a piece was born in — used to resolve a broken-out piece's challan (the piece row
// itself carries no stockInTransactionId when it was created by a break).
const originItem = aliasedTable(stockItem, "origin_item");
const originTxn = aliasedTable(stockInTransaction, "origin_txn");

const activeShortCodeSql = sql`(select ${stockItemQr.shortCode} from ${stockItemQr} where ${stockItemQr.stockItemId} = ${stockItem.id} and ${stockItemQr.status} = 'ACTIVE' order by ${stockItemQr.generatedAt} desc limit 1)`;

// Every column needed to show a piece/unit anywhere on the Stock Transformation page.
const itemViewColumns = {
    stockItemId: stockItem.id,
    type: stockItem.type,
    status: stockItem.status,
    colorVariantId: stockItem.colorVariantId,
    stockGroupId: stockItem.stockGroupId,
    designSizeId: stockItem.designSizeId,
    sizeLabel: designSize.sizeLabel,
    sizeOrder: designSize.displayOrder,
    parentStockItemId: stockItem.parentStockItemId,
    originSetStockItemId: stockItem.originSetStockItemId,
    custodyType: stockItem.custodyType,
    custodyHolder: stockItem.custodyHolder,
    custodySince: stockItem.custodySince,
    createdAt: stockItem.createdAt,
    shortCode: activeShortCodeSql,
    challanNo: sql`coalesce(${stockInTransaction.challanNo}, ${originTxn.challanNo})`,
    receivedOn: sql`coalesce(${stockInTransaction.stockDate}, ${originTxn.stockDate}, ${stockItem.createdAt}::date)`.mapWith(String),
    designId: design.id,
    designCode: design.code,
    designName: design.name,
    sellingPricePerPiece: design.defaultSellingPricePerPiece,
    colorName: colorVariant.colorName,
    colorHex: colorVariant.colorHex,
};

function itemViewQuery(runner) {
    return runner.select(itemViewColumns).from(stockItem)
        .innerJoin(colorVariant, eq(stockItem.colorVariantId, colorVariant.id))
        .innerJoin(design, eq(colorVariant.designId, design.id))
        .leftJoin(designSize, eq(stockItem.designSizeId, designSize.id))
        .leftJoin(stockInTransaction, eq(stockItem.stockInTransactionId, stockInTransaction.id))
        .leftJoin(originItem, eq(stockItem.originSetStockItemId, originItem.id))
        .leftJoin(originTxn, eq(originItem.stockInTransactionId, originTxn.id));
}

// A loose piece: its own unit of stock, not inside any set. Tagged (PIECE) or untagged
// (LOOSE_PIECE, which is never inside a set — forming consumes it instead).
const isLoosePiece = and(
    ne(stockItem.status, "CONSUMED"),
    or(eq(stockItem.type, "LOOSE_PIECE"), and(eq(stockItem.type, "PIECE"), isNull(stockItem.parentStockItemId))),
);

class StockTransformationRepository {
    // --- item views --------------------------------------------------------------------------

    async findItemViewsByIds(runner, ids) {
        if (ids.length === 0) return [];
        return itemViewQuery(runner).where(inArray(stockItem.id, ids));
    }

    // Every loose piece (in stock or out with someone), network-wide — the pool the suggestion
    // engine, the "Pieces out" board and the stats all work from.
    async findAllLoosePieces(runner) {
        return itemViewQuery(runner)
            .where(and(isLoosePiece, eq(colorVariant.isActive, true)))
            .orderBy(asc(stockItem.id));
    }

    async findLoosePiecesForVariant(runner, colorVariantId) {
        return itemViewQuery(runner)
            .where(and(isLoosePiece, eq(stockItem.colorVariantId, colorVariantId)))
            .orderBy(asc(stockItem.id));
    }

    // Broken sets still worth tracking: consumed SET/BUNDLE units with at least one piece born in
    // them that is still loose (in stock or out). Once every piece is sold or inside another set,
    // the broken set drops off.
    async findTrackedBrokenUnitIds(runner) {
        const rows = await runner.selectDistinct({ id: stockItem.originSetStockItemId }).from(stockItem)
            .innerJoin(originItem, eq(stockItem.originSetStockItemId, originItem.id))
            .where(and(
                eq(stockItem.type, "PIECE"),
                isNotNull(stockItem.originSetStockItemId),
                isNull(stockItem.parentStockItemId),
                ne(stockItem.status, "CONSUMED"),
                eq(originItem.status, "CONSUMED"),
            ));
        return rows.map((row) => row.id);
    }

    async findPiecesBornIn(runner, unitIds) {
        if (unitIds.length === 0) return [];
        return itemViewQuery(runner)
            .where(and(eq(stockItem.type, "PIECE"), inArray(stockItem.originSetStockItemId, unitIds)))
            .orderBy(asc(designSize.displayOrder), asc(stockItem.id));
    }

    async findChildrenInside(runner, unitId) {
        return itemViewQuery(runner)
            .where(and(eq(stockItem.parentStockItemId, unitId), eq(stockItem.type, "PIECE"), ne(stockItem.status, "CONSUMED")))
            .orderBy(asc(designSize.displayOrder), asc(stockItem.id));
    }

    // Resolves a scanned/typed code to its stock item: an ACTIVE QR short code first, then any
    // QR (retired codes still identify the item, e.g. a broken set), then "#123" / "123".
    async findItemIdByCode(runner, code) {
        const trimmed = code.trim();

        // QR Center labels encode the full JSON payload ({ designCode, …, setId }) rather than the
        // short code — a gun scan of one of those delivers the JSON itself.
        if (trimmed.startsWith("{")) {
            try {
                const setId = Number(JSON.parse(trimmed).setId);
                if (Number.isInteger(setId) && setId > 0) return setId;
            } catch {
                // not JSON after all — fall through to short-code lookup
            }
        }

        const [active] = await runner.select({ id: stockItemQr.stockItemId }).from(stockItemQr)
            .where(and(sql`upper(${stockItemQr.shortCode}) = upper(${trimmed})`, eq(stockItemQr.status, "ACTIVE")))
            .orderBy(desc(stockItemQr.generatedAt)).limit(1);
        if (active) return active.id;

        const [any] = await runner.select({ id: stockItemQr.stockItemId }).from(stockItemQr)
            .where(sql`upper(${stockItemQr.shortCode}) = upper(${trimmed})`)
            .orderBy(desc(stockItemQr.generatedAt)).limit(1);
        if (any) return any.id;

        const numeric = /^#?(\d+)$/.exec(trimmed);
        return numeric ? Number(numeric[1]) : null;
    }

    // Latest QR short code (any status) per item — so a retired parent still shows its old code.
    async findLatestShortCodes(runner, ids) {
        if (ids.length === 0) return new Map();
        const rows = await runner.select({ stockItemId: stockItemQr.stockItemId, shortCode: stockItemQr.shortCode })
            .from(stockItemQr)
            .where(inArray(stockItemQr.stockItemId, ids))
            .orderBy(desc(stockItemQr.generatedAt));
        const map = new Map();
        for (const row of rows) if (!map.has(row.stockItemId)) map.set(row.stockItemId, row.shortCode);
        return map;
    }

    // --- locking + mutation ------------------------------------------------------------------

    async lockItems(tx, ids) {
        if (ids.length === 0) return [];
        return tx.select().from(stockItem).where(inArray(stockItem.id, ids)).orderBy(asc(stockItem.id)).for("update");
    }

    async lockChildrenInside(tx, unitId) {
        return tx.select().from(stockItem)
            .where(and(eq(stockItem.parentStockItemId, unitId), eq(stockItem.type, "PIECE"), ne(stockItem.status, "CONSUMED")))
            .orderBy(asc(stockItem.id))
            .for("update");
    }

    async updateItem(tx, id, patch) {
        await tx.update(stockItem).set(patch).where(eq(stockItem.id, id));
    }

    async findQrRowsByItemIds(tx, ids) {
        if (ids.length === 0) return [];
        return tx.select({
            id: stockItemQr.id,
            stockItemId: stockItemQr.stockItemId,
            status: stockItemQr.status,
            retiredAt: stockItemQr.retiredAt,
            retiredReason: stockItemQr.retiredReason,
        }).from(stockItemQr).where(inArray(stockItemQr.stockItemId, ids)).orderBy(asc(stockItemQr.id));
    }

    async updateQr(tx, id, patch) {
        await tx.update(stockItemQr).set(patch).where(eq(stockItemQr.id, id));
    }

    async deleteLineageByResultIds(tx, resultIds) {
        if (resultIds.length === 0) return;
        await tx.delete(stockItemLineage).where(inArray(stockItemLineage.resultStockItemId, resultIds));
    }

    // --- log ---------------------------------------------------------------------------------

    async createEntry(tx, data) {
        const [result] = await tx.insert(stockTransformation).values(data).returning();
        return result;
    }

    async findEntryForUpdate(tx, id) {
        const [result] = await tx.select().from(stockTransformation).where(eq(stockTransformation.id, id)).limit(1).for("update");
        return result;
    }

    async markUndone(tx, id) {
        await tx.update(stockTransformation).set({ undoneAt: new Date() }).where(eq(stockTransformation.id, id));
    }

    async findEntries(runner, { limit }) {
        return runner.select({
            entry: stockTransformation,
            designCode: design.code,
            designName: design.name,
            colorName: colorVariant.colorName,
            colorHex: colorVariant.colorHex,
        }).from(stockTransformation)
            .innerJoin(colorVariant, eq(stockTransformation.colorVariantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .orderBy(desc(stockTransformation.createdAt), desc(stockTransformation.id))
            .limit(limit);
    }

    async countEntries(runner) {
        const [result] = await runner.select({ value: sql`count(*)`.mapWith(Number) }).from(stockTransformation);
        return result.value;
    }

    // Names used before, per custody type — suggestions for the "who has it" fields.
    async findKnownHolders(runner) {
        const current = await runner.selectDistinct({ type: stockItem.custodyType, holder: stockItem.custodyHolder })
            .from(stockItem).where(isNotNull(stockItem.custodyHolder));
        const past = await runner.execute(sql`
            select distinct h->>'type' as type, h->>'holder' as holder
            from ${stockTransformation}, jsonb_array_elements(coalesce(${stockTransformation.metadata}->'holders', '[]'::jsonb)) h
            where h->>'holder' is not null and h->>'holder' <> ''`);
        return [...current, ...(past.rows ?? past)];
    }
}

export default new StockTransformationRepository();
