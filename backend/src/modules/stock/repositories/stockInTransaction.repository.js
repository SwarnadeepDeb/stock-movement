import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";

import { stockInTransaction } from "../schemas/stockInTransaction.schema.js";
import { stockItem } from "../schemas/stockItems.schema.js";
import { stockItemQr } from "../schemas/stockItemQr.schema.js";
import { stockInLoosePiece } from "../schemas/stockInLoosePiece.schema.js";
import { stockInEntry } from "../schemas/stockInEntry.schema.js";
import { printJobItem } from "../schemas/printJobItem.schema.js";
import { colorVariant } from "../../design/schemas/colorVariant.schema.js";
import { design } from "../../design/schemas/design.schema.js";

// A stock item only ever gets a physical QR label as a SET or BUNDLE — same rule as
// stockQr.service.js's QR_ELIGIBLE_TYPES — so a registration's QR-bearing items are
// scoped to those two types here too.
const QR_ELIGIBLE_TYPES = ["SET", "BUNDLE"];

// Start of the current calendar month, as a date — Stock In dashboard stats are scoped by the
// transaction's own stockDate (the challan/inward date the user entered), not createdAt.
const currentMonthStart = sql`date_trunc('month', current_date)::date`;

// Correlated per-transaction counts for the Stock In dashboard. A transaction's QR labels are
// the ACTIVE stock_item_qr rows of its own stock items; a label counts as printed once any
// print job has included it (print_job_items), whichever path queued that job — Stock In's
// "Send to printer" or QR Center's batch queue.
const piecesAddedSql = sql`coalesce((select sum(${stockInEntry.quantityAdded}) from ${stockInEntry} where ${stockInEntry.stockInTransactionId} = ${stockInTransaction.id}), 0)`;
const activeQrCountSql = sql`(select count(distinct ${stockItemQr.id}) from ${stockItemQr} inner join ${stockItem} on ${stockItem.id} = ${stockItemQr.stockItemId} where ${stockItem.stockInTransactionId} = ${stockInTransaction.id} and ${stockItemQr.status} = 'ACTIVE')`;
const printedQrCountSql = sql`(select count(distinct ${stockItemQr.id}) from ${stockItemQr} inner join ${stockItem} on ${stockItem.id} = ${stockItemQr.stockItemId} inner join ${printJobItem} on ${printJobItem.stockItemQrId} = ${stockItemQr.id} where ${stockItem.stockInTransactionId} = ${stockInTransaction.id} and ${stockItemQr.status} = 'ACTIVE')`;

function registrationSearchCondition(keyword) {
    if (!keyword) return undefined;

    return or(ilike(design.code, `%${keyword}%`), ilike(design.name, `%${keyword}%`), ilike(colorVariant.colorName, `%${keyword}%`), ilike(stockInTransaction.challanNo, `%${keyword}%`));
}

// designId/colorVariantId/dateFrom/dateTo are the QR Center history section's filter row —
// each pushed as a condition only when present, same "push only if truthy" pattern as
// registrationSearchCondition, so existing callers passing none of these behave identically.
function registrationFilterConditions({ keyword, designId, colorVariantId, dateFrom, dateTo }) {
    const conditions = [registrationSearchCondition(keyword)].filter(Boolean);
    if (designId) conditions.push(eq(design.id, designId));
    if (colorVariantId) conditions.push(eq(colorVariant.id, colorVariantId));
    if (dateFrom) conditions.push(gte(stockInTransaction.stockDate, dateFrom));
    if (dateTo) conditions.push(lte(stockInTransaction.stockDate, dateTo));
    return conditions.length ? and(...conditions) : undefined;
}

class StockInTransactionRepository {
    async create(tx, data) {
        const [result] = await tx.insert(stockInTransaction).values(data).returning();

        return result;
    }

    // QR Center listing: one row per Stock Registration (stock_in_transaction) that produced
    // at least one QR-eligible stock item — a registration with only loose pieces never had a
    // QR to generate, so it's excluded via the HAVING clause below rather than shown empty.
    // Counts are DISTINCT because stock_item_qr can carry more than one history row per stock
    // item (see stockItemQr.schema.js) — a plain COUNT(qr.id) would double-count those.
    async findRegistrationsWithQr(tx, { limit, offset, keyword, designId, colorVariantId, dateFrom, dateTo }) {
        const eligibleItemCount = sql`count(distinct ${stockItem.id})`.mapWith(Number);
        const setCount = sql`count(distinct ${stockItem.id}) filter (where ${stockItem.type} = 'SET')`.mapWith(Number);
        const bundleCount = sql`count(distinct ${stockItem.id}) filter (where ${stockItem.type} = 'BUNDLE')`.mapWith(Number);
        const qrGeneratedCount = sql`count(distinct ${stockItemQr.stockItemId})`.mapWith(Number);

        return tx.select({
            stockInTransactionId: stockInTransaction.id,
            challanNo: stockInTransaction.challanNo,
            stockDate: stockInTransaction.stockDate,
            createdAt: stockInTransaction.createdAt,
            colorVariantId: colorVariant.id,
            colorName: colorVariant.colorName,
            colorHex: colorVariant.colorHex,
            imageUrl: colorVariant.imageUrl,
            designId: design.id,
            designCode: design.code,
            designName: design.name,
            eligibleItemCount,
            setCount,
            bundleCount,
            qrGeneratedCount,
        }).from(stockInTransaction)
            .innerJoin(colorVariant, eq(stockInTransaction.variantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .innerJoin(stockItem, and(eq(stockItem.stockInTransactionId, stockInTransaction.id), inArray(stockItem.type, QR_ELIGIBLE_TYPES)))
            .leftJoin(stockItemQr, eq(stockItemQr.stockItemId, stockItem.id))
            .where(registrationFilterConditions({ keyword, designId, colorVariantId, dateFrom, dateTo }))
            .groupBy(stockInTransaction.id, colorVariant.id, design.id)
            .having(sql`count(distinct ${stockItem.id}) > 0`)
            .orderBy(desc(stockInTransaction.createdAt))
            .limit(limit)
            .offset(offset);
    }

    // Same eligibility/grouping rule as findRegistrationsWithQr, collapsed to a row count for
    // pagination — a plain count() can't follow a GROUP BY/HAVING directly, so the grouped
    // query is used as a subquery here.
    async countRegistrationsWithQr(tx, { keyword, designId, colorVariantId, dateFrom, dateTo }) {
        const grouped = tx.select({ id: stockInTransaction.id })
            .from(stockInTransaction)
            .innerJoin(colorVariant, eq(stockInTransaction.variantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .innerJoin(stockItem, and(eq(stockItem.stockInTransactionId, stockInTransaction.id), inArray(stockItem.type, QR_ELIGIBLE_TYPES)))
            .where(registrationFilterConditions({ keyword, designId, colorVariantId, dateFrom, dateTo }))
            .groupBy(stockInTransaction.id)
            .as("registrations_with_qr");

        const [result] = await tx.select({ value: sql`count(*)`.mapWith(Number) }).from(grouped);

        return result.value;
    }

    // QR Center's "To tag" queue: registrations whose QR-eligible (SET/BUNDLE) items are not
    // all tagged yet (eligibleItemCount > qrGeneratedCount — same counts findRegistrationsWithQr
    // computes, just filtered the opposite way via HAVING). Loose piece quantity is informational
    // context on the row (loose stock is never individually QR-eligible — see
    // stockItem.repository.js isQrEligible), not part of the tagging gap itself.
    async findUntaggedRegistrations(tx, { limit, offset }) {
        const eligibleItemCount = sql`count(distinct ${stockItem.id})`.mapWith(Number);
        const qrGeneratedCount = sql`count(distinct ${stockItemQr.stockItemId})`.mapWith(Number);
        const looseCount = sql`coalesce((select sum(${stockInLoosePiece.quantity}) from ${stockInLoosePiece} where ${stockInLoosePiece.stockInTransactionId} = ${stockInTransaction.id}), 0)`.mapWith(Number);

        return tx.select({
            stockInTransactionId: stockInTransaction.id,
            challanNo: stockInTransaction.challanNo,
            stockDate: stockInTransaction.stockDate,
            createdAt: stockInTransaction.createdAt,
            colorVariantId: colorVariant.id,
            colorName: colorVariant.colorName,
            colorHex: colorVariant.colorHex,
            imageUrl: colorVariant.imageUrl,
            designId: design.id,
            designCode: design.code,
            designName: design.name,
            eligibleItemCount,
            qrGeneratedCount,
            looseCount,
        }).from(stockInTransaction)
            .innerJoin(colorVariant, eq(stockInTransaction.variantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .innerJoin(stockItem, and(eq(stockItem.stockInTransactionId, stockInTransaction.id), inArray(stockItem.type, QR_ELIGIBLE_TYPES)))
            .leftJoin(stockItemQr, eq(stockItemQr.stockItemId, stockItem.id))
            .groupBy(stockInTransaction.id, colorVariant.id, design.id)
            .having(sql`count(distinct ${stockItem.id}) > count(distinct ${stockItemQr.stockItemId})`)
            .orderBy(desc(stockInTransaction.createdAt))
            .limit(limit)
            .offset(offset);
    }

    async countUntaggedRegistrations(tx) {
        const grouped = tx.select({ id: stockInTransaction.id })
            .from(stockInTransaction)
            .innerJoin(stockItem, and(eq(stockItem.stockInTransactionId, stockInTransaction.id), inArray(stockItem.type, QR_ELIGIBLE_TYPES)))
            .leftJoin(stockItemQr, eq(stockItemQr.stockItemId, stockItem.id))
            .groupBy(stockInTransaction.id)
            .having(sql`count(distinct ${stockItem.id}) > count(distinct ${stockItemQr.stockItemId})`)
            .as("untagged_registrations");

        const [result] = await tx.select({ value: sql`count(*)`.mapWith(Number) }).from(grouped);
        return result.value;
    }

    // Stock In dashboard's "this month" strip: how many registrations were inwarded this
    // calendar month and how many physical pieces they added in total.
    async getCurrentMonthTotals(tx) {
        const [batches] = await tx.select({ value: sql`count(*)`.mapWith(Number) })
            .from(stockInTransaction)
            .where(gte(stockInTransaction.stockDate, currentMonthStart));

        const [pieces] = await tx.select({ value: sql`coalesce(sum(${stockInEntry.quantityAdded}), 0)`.mapWith(Number) })
            .from(stockInEntry)
            .innerJoin(stockInTransaction, eq(stockInEntry.stockInTransactionId, stockInTransaction.id))
            .where(gte(stockInTransaction.stockDate, currentMonthStart));

        return { batchCount: batches.value, pieceCount: pieces.value };
    }

    // Registrations that still have at least one ACTIVE QR label no print job has included yet.
    async countWithUnprintedQr(tx) {
        const [result] = await tx.select({ value: sql`count(*)`.mapWith(Number) })
            .from(stockInTransaction)
            .where(sql`${activeQrCountSql} > ${printedQrCountSql}`);
        return result.value;
    }

    // Stock In dashboard's "Recently completed" list — newest registrations first, each with
    // its design/variant identity, pieces added and QR print progress.
    async findRecentWithPrintStatus(tx, { limit }) {
        return tx.select({
            stockInTransactionId: stockInTransaction.id,
            challanNo: stockInTransaction.challanNo,
            stockDate: stockInTransaction.stockDate,
            createdAt: stockInTransaction.createdAt,
            colorVariantId: colorVariant.id,
            colorName: colorVariant.colorName,
            colorHex: colorVariant.colorHex,
            designId: design.id,
            designCode: design.code,
            designName: design.name,
            pieceCount: piecesAddedSql.mapWith(Number),
            qrCount: activeQrCountSql.mapWith(Number),
            printedCount: printedQrCountSql.mapWith(Number),
        }).from(stockInTransaction)
            .innerJoin(colorVariant, eq(stockInTransaction.variantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .orderBy(desc(stockInTransaction.createdAt), desc(stockInTransaction.id))
            .limit(limit);
    }

    // Stock Registration identity + design/variant context for the QR Grid page header —
    // deliberately not the raw stock_in_transaction row so the grid page never has to also
    // fetch the design/variant separately.
    async findByIdWithContext(tx, id) {
        const [result] = await tx.select({
            stockInTransactionId: stockInTransaction.id,
            stockDate: stockInTransaction.stockDate,
            challanNo: stockInTransaction.challanNo,
            createdAt: stockInTransaction.createdAt,
            notes: stockInTransaction.notes,
            colorVariantId: colorVariant.id,
            colorName: colorVariant.colorName,
            colorHex: colorVariant.colorHex,
            imageUrl: colorVariant.imageUrl,
            designId: design.id,
            designCode: design.code,
            designName: design.name,
        }).from(stockInTransaction)
            .innerJoin(colorVariant, eq(stockInTransaction.variantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .where(eq(stockInTransaction.id, id))
            .limit(1);

        return result;
    }
}

export default new StockInTransactionRepository();
