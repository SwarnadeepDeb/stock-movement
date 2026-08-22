import { and, asc, desc, eq, inArray, isNull, ne, notExists, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { stockInTransaction } from "../schemas/stockInTransaction.schema.js";
import { stockInChallan } from "../schemas/stockInChallan.schema.js";
import { stockInBundlePiece } from "../schemas/stockInBundlePiece.schema.js";
import { stockItem } from "../schemas/stockItems.schema.js";
import { stockItemQr } from "../schemas/stockItemQr.schema.js";
import { printJobItem } from "../schemas/printJobItem.schema.js";
import { variantSerialCounter } from "../schemas/variantSerialCounter.schema.js";
import { colorVariant } from "../../design/schemas/colorVariant.schema.js";
import { design } from "../../design/schemas/design.schema.js";
import { designSize } from "../../design/schemas/designSize.schema.js";

// Stock items / QR rows are fetched for a whole batch at once; a batch can hold thousands of
// pieces, so id lists are chunked to stay well under Postgres' bind-parameter limit.
const CHUNK = 5000;

const chunked = async (ids, fetchChunk) => {
    const rows = [];
    for (let i = 0; i < ids.length; i += CHUNK) rows.push(...await fetchChunk(ids.slice(i, i + CHUNK)));
    return rows;
};

// Read model behind QR Center's "Stock-in history": one batch = one stock-in challan, which
// holds one stock_in_transaction per colour variant inwarded on it. A transaction with no
// challan (data from before challans existed) is its own batch.
class QrBatchRepository {
    // Every stock-in transaction (with its challan, design and colour) that is not on a voided
    // challan, newest first. `challanId` / `transactionId` narrow it to one batch.
    async findTransactionContexts(runner, { challanId, transactionId, limit } = {}) {
        const conditions = [or(isNull(stockInTransaction.challanId), eq(stockInChallan.status, "ACTIVE"))];
        if (challanId) conditions.push(eq(stockInTransaction.challanId, challanId));
        if (transactionId) conditions.push(eq(stockInTransaction.id, transactionId));

        const query = runner.select({
            transactionId: stockInTransaction.id,
            challanId: stockInTransaction.challanId,
            challanNo: sql`coalesce(${stockInChallan.challanNo}, ${stockInTransaction.challanNo})`.mapWith(String),
            challanSerial: stockInChallan.serial,
            jobberName: stockInChallan.jobberName,
            defectAction: stockInChallan.defectAction,
            stockDate: stockInTransaction.stockDate,
            createdAt: stockInTransaction.createdAt,
            totalSetsReceived: stockInTransaction.totalSetsReceived,
            defectivePieces: stockInTransaction.defectivePieces,
            colorVariantId: colorVariant.id,
            colorName: colorVariant.colorName,
            colorHex: colorVariant.colorHex,
            designId: design.id,
            designCode: design.code,
            designName: design.name,
            defaultPrice: design.defaultSellingPricePerPiece,
        }).from(stockInTransaction)
            .leftJoin(stockInChallan, eq(stockInChallan.id, stockInTransaction.challanId))
            .innerJoin(colorVariant, eq(colorVariant.id, stockInTransaction.variantId))
            .innerJoin(design, eq(design.id, colorVariant.designId))
            .where(and(...conditions))
            .orderBy(desc(stockInTransaction.createdAt), desc(stockInTransaction.id));

        return limit ? query.limit(limit) : query;
    }

    // The batch's own stock items (sets, semi sets, tagged pieces and the untagged loose pool).
    // Pieces made later by a transformation carry no stockInTransactionId and are not part of
    // what was inwarded, so they are deliberately not matched here.
    async findItems(runner, transactionIds) {
        return chunked(transactionIds, (ids) => runner.select({
            id: stockItem.id,
            stockInTransactionId: stockItem.stockInTransactionId,
            colorVariantId: stockItem.colorVariantId,
            type: stockItem.type,
            status: stockItem.status,
            bundleId: stockItem.bundleId,
            designSizeId: stockItem.designSizeId,
            sizeLabel: designSize.sizeLabel,
            sizePrice: designSize.unsetPricePerSize,
            originSetStockItemId: stockItem.originSetStockItemId,
            parentStockItemId: stockItem.parentStockItemId,
            serialNo: stockItem.serialNo,
        }).from(stockItem)
            .leftJoin(designSize, eq(designSize.id, stockItem.designSizeId))
            .where(inArray(stockItem.stockInTransactionId, ids))
            .orderBy(asc(stockItem.id)));
    }

    // Tag counts per transaction for the history list, without loading every piece: how many
    // stock items carry a live (ACTIVE) QR code, how many of those some print job has included,
    // plus the untagged loose pool that could still be given tags.
    async findTagStats(runner, transactionIds) {
        const stats = await chunked(transactionIds, (ids) => runner.select({
            transactionId: stockItem.stockInTransactionId,
            issued: sql`count(distinct ${stockItem.id}) filter (where ${stockItemQr.status} = 'ACTIVE')`.mapWith(Number),
            printed: sql`count(distinct ${stockItem.id}) filter (where ${stockItemQr.status} = 'ACTIVE' and ${printJobItem.id} is not null)`.mapWith(Number),
            sets: sql`count(distinct ${stockItem.id}) filter (where ${stockItem.type} = 'SET')`.mapWith(Number),
            semiSets: sql`count(distinct ${stockItem.id}) filter (where ${stockItem.type} = 'BUNDLE')`.mapWith(Number),
            loosePool: sql`count(distinct ${stockItem.id}) filter (where ${stockItem.type} = 'LOOSE_PIECE' and ${stockItem.status} = 'UNSET')`.mapWith(Number),
            looseTagged: sql`count(distinct ${stockItem.id}) filter (where ${stockItem.type} = 'PIECE' and ${stockItem.originSetStockItemId} is null)`.mapWith(Number),
        }).from(stockItem)
            .leftJoin(stockItemQr, eq(stockItemQr.stockItemId, stockItem.id))
            .leftJoin(printJobItem, eq(printJobItem.stockItemQrId, stockItemQr.id))
            .where(inArray(stockItem.stockInTransactionId, ids))
            .groupBy(stockItem.stockInTransactionId));

        return new Map(stats.map((row) => [row.transactionId, row]));
    }

    // Sets and semi sets still in stock that were never given piece tags — the tags a batch could
    // still gain by choosing Parent + Child.
    async findParentsWithoutChildren(runner, transactionIds) {
        const child = alias(stockItem, "child");

        return chunked(transactionIds, (ids) => runner.select({
            id: stockItem.id,
            transactionId: stockItem.stockInTransactionId,
            type: stockItem.type,
            bundleId: stockItem.bundleId,
        }).from(stockItem)
            .where(and(
                inArray(stockItem.stockInTransactionId, ids),
                inArray(stockItem.type, ["SET", "BUNDLE"]),
                ne(stockItem.status, "CONSUMED"),
                notExists(runner.select({ one: sql`1` }).from(child).where(and(eq(child.originSetStockItemId, stockItem.id), eq(child.type, "PIECE")))),
            ))
            .orderBy(asc(stockItem.id)));
    }

    // Every QR row of these items, newest first — a reprint leaves older (retired) rows behind.
    async findQrRows(runner, stockItemIds) {
        return chunked(stockItemIds, (ids) => runner.select({
            id: stockItemQr.id,
            stockItemId: stockItemQr.stockItemId,
            shortCode: stockItemQr.shortCode,
            payload: stockItemQr.payload,
            status: stockItemQr.status,
            priceSnapshot: stockItemQr.priceSnapshot,
            generatedAt: stockItemQr.generatedAt,
        }).from(stockItemQr)
            .where(inArray(stockItemQr.stockItemId, ids))
            .orderBy(desc(stockItemQr.generatedAt), desc(stockItemQr.id)));
    }

    // Ids of the given QR rows that some print job has already included.
    async findPrintedQrIds(runner, qrIds) {
        const rows = await chunked(qrIds, (ids) => runner
            .selectDistinct({ stockItemQrId: printJobItem.stockItemQrId })
            .from(printJobItem)
            .where(inArray(printJobItem.stockItemQrId, ids)));
        return new Set(rows.map((row) => row.stockItemQrId));
    }

    // Active sizes per colour variant, in display order, with their selling price.
    async findActiveSizes(runner, colorVariantIds) {
        if (colorVariantIds.length === 0) return [];

        return runner.select({
            id: designSize.id,
            variantId: designSize.variantId,
            sizeLabel: designSize.sizeLabel,
            includedInSet: designSize.includedInSet,
            displayOrder: designSize.displayOrder,
            price: designSize.unsetPricePerSize,
        }).from(designSize)
            .where(and(inArray(designSize.variantId, colorVariantIds), eq(designSize.isActive, true)))
            .orderBy(asc(designSize.displayOrder), asc(designSize.id));
    }

    async findBundlePieces(runner, bundleIds) {
        return chunked(bundleIds, (ids) => runner.select().from(stockInBundlePiece).where(inArray(stockInBundlePiece.bundleId, ids)));
    }

    async findSerialCounters(runner, colorVariantIds) {
        if (colorVariantIds.length === 0) return [];
        return runner.select().from(variantSerialCounter).where(inArray(variantSerialCounter.colorVariantId, colorVariantIds));
    }

    // Untagged loose stock becomes an individually tagged piece, in place: the row keeps its id
    // (so history and lineage still point at it) and joins the variant's PIECE group — the same
    // shape Stock In produces when it tags loose pieces at inward time.
    async convertLooseToTagged(tx, ids, { stockGroupId }) {
        if (ids.length === 0) return [];

        return tx.update(stockItem)
            .set({ type: "PIECE", status: "AVAILABLE", stockGroupId, unsetAt: null })
            .where(and(inArray(stockItem.id, ids), eq(stockItem.type, "LOOSE_PIECE"), eq(stockItem.status, "UNSET")))
            .returning();
    }

    async assignSerial(tx, stockItemId, serialNo) {
        await tx.update(stockItem).set({ serialNo }).where(eq(stockItem.id, stockItemId));
    }
}

export default new QrBatchRepository();
