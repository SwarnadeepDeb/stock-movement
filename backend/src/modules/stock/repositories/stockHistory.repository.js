import { and, count, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";

import { stockHistory } from "../schemas/stockHistory.schema.js";
import { stockInTransaction } from "../schemas/stockInTransaction.schema.js";
import { stockOutTransaction } from "../schemas/stockOutTransaction.schema.js";
import { colorVariant } from "../../design/schemas/colorVariant.schema.js";
import { design } from "../../design/schemas/design.schema.js";

// The two event types that represent a "transformation": loose pieces assembled into a
// SET or BUNDLE. QR Center treats a row of either type as one transformation registration —
// see qrCenter.service.js.
const ASSEMBLY_EVENT_TYPES = ["SET_ASSEMBLED", "BUNDLE_ASSEMBLED"];

const registrationColumns = {
    id: stockHistory.id,
    eventType: stockHistory.eventType,
    createdAt: stockHistory.createdAt,
    quantity: stockHistory.quantity,
    metadata: stockHistory.metadata,
    colorVariantId: stockHistory.colorVariantId,
    colorName: colorVariant.colorName,
    colorHex: colorVariant.colorHex,
    imageUrl: colorVariant.imageUrl,
    designId: design.id,
    designCode: design.code,
    designName: design.name,
};

function registrationSearchCondition(keyword) {
    if (!keyword) return undefined;

    return or(ilike(design.code, `%${keyword}%`), ilike(design.name, `%${keyword}%`), ilike(colorVariant.colorName, `%${keyword}%`));
}

function assemblyRegistrationConditions(keyword) {
    const conditions = [inArray(stockHistory.eventType, ASSEMBLY_EVENT_TYPES)];
    const search = registrationSearchCondition(keyword);
    if (search) conditions.push(search);

    return and(...conditions);
}

const listColumns = {
    id: stockHistory.id,
    eventType: stockHistory.eventType,
    createdAt: stockHistory.createdAt,
    quantity: stockHistory.quantity,
    metadata: stockHistory.metadata,
    colorVariantId: stockHistory.colorVariantId,
    colorName: colorVariant.colorName,
    colorHex: colorVariant.colorHex,
    designId: design.id,
    designCode: design.code,
    designName: design.name,
    stockInTransactionId: stockHistory.stockInTransactionId,
    stockOutTransactionId: stockHistory.stockOutTransactionId,
    // STOCK_IN rows carry a date via stock_in_transactions.stock_date; STOCK_OUT rows via
    // stock_out_transactions.transaction_date — coalesced into one field since a given row is
    // only ever one or the other.
    stockDate: sql`coalesce(${stockInTransaction.stockDate}::text, ${stockOutTransaction.transactionDate}::text)`,
    // Challan No. is a Stock In-only concept (a supplier delivery reference) — stock_out_transactions
    // has no equivalent field, so this is simply null for STOCK_OUT/transformation rows.
    challanNo: stockInTransaction.challanNo,
};

// dateFrom/dateTo arrive as plain "YYYY-MM-DD" strings (same convention as
// stockInTransaction.stockDate — see stockIn.validator.js). createdAt is a full timestamp, so a
// bare date-only bound would silently exclude everything after midnight on dateTo; widen both
// ends to the full requested day in UTC so the range is genuinely inclusive.
function startOfDayUtc(dateOnly) {
    return new Date(`${dateOnly}T00:00:00.000Z`);
}

function endOfDayUtc(dateOnly) {
    return new Date(`${dateOnly}T23:59:59.999Z`);
}

function buildFilters({ eventType, colorVariantId, dateFrom, dateTo, keyword }) {
    const conditions = [];

    if (eventType) conditions.push(eq(stockHistory.eventType, eventType));
    if (colorVariantId) conditions.push(eq(stockHistory.colorVariantId, colorVariantId));
    if (dateFrom) conditions.push(gte(stockHistory.createdAt, startOfDayUtc(dateFrom)));
    if (dateTo) conditions.push(lte(stockHistory.createdAt, endOfDayUtc(dateTo)));
    if (keyword) {
        conditions.push(or(
            ilike(design.code, `%${keyword}%`),
            ilike(design.name, `%${keyword}%`),
            ilike(colorVariant.colorName, `%${keyword}%`)
        ));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
}

class StockHistoryRepository {
    // Called only with `tx` from inside the stock-mutation transaction that produced the event
    // (see stockIn.service.js / stockItem.service.js) — never on its own.
    async create(tx, data) {
        const [result] = await tx.insert(stockHistory).values(data).returning();

        return result;
    }

    // `runner` is `db` for reads (this repository never needs a transaction to list history) —
    // same generic-first-arg convention as every other repository in this module.
    async findMany(runner, { limit, offset, eventType, colorVariantId, dateFrom, dateTo, keyword }) {
        return runner.select(listColumns).from(stockHistory)
            .innerJoin(colorVariant, eq(stockHistory.colorVariantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .leftJoin(stockInTransaction, eq(stockHistory.stockInTransactionId, stockInTransaction.id))
            .leftJoin(stockOutTransaction, eq(stockHistory.stockOutTransactionId, stockOutTransaction.id))
            .where(buildFilters({ eventType, colorVariantId, dateFrom, dateTo, keyword }))
            .orderBy(desc(stockHistory.createdAt), desc(stockHistory.id))
            .limit(limit)
            .offset(offset);
    }

    async count(runner, { eventType, colorVariantId, dateFrom, dateTo, keyword }) {
        const [result] = await runner.select({ value: count() }).from(stockHistory)
            .innerJoin(colorVariant, eq(stockHistory.colorVariantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .where(buildFilters({ eventType, colorVariantId, dateFrom, dateTo, keyword }));

        return result.value;
    }

    // One row per transformation event (SET_ASSEMBLED/BUNDLE_ASSEMBLED), for QR Center — same
    // "one registration per event" shape as stockInTransaction.repository's
    // findRegistrationsWithQr, but far simpler: a transformation's QR generation always
    // completes inside the same transaction as the event (see stockItem.service.js
    // assembleSet/assembleBundle), so there is no join-driven eligible-vs-generated count to
    // compute here — `quantity` IS both figures. No `offset`: qrCenter.service.js merges this
    // with Stock In registrations in memory and paginates the combined, sorted result there.
    async findAssemblyRegistrations(runner, { limit, keyword }) {
        return runner.select(registrationColumns).from(stockHistory)
            .innerJoin(colorVariant, eq(stockHistory.colorVariantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .where(assemblyRegistrationConditions(keyword))
            .orderBy(desc(stockHistory.createdAt), desc(stockHistory.id))
            .limit(limit);
    }

    async countAssemblyRegistrations(runner, { keyword }) {
        const [result] = await runner.select({ value: count() }).from(stockHistory)
            .innerJoin(colorVariant, eq(stockHistory.colorVariantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .where(assemblyRegistrationConditions(keyword));

        return result.value;
    }

    // Single transformation event + its design/variant identity, for QR Center's registration
    // detail page — same "context baked in, not a separate fetch" convention as
    // stockInTransaction.repository's findByIdWithContext.
    async findByIdWithContext(runner, id) {
        const [result] = await runner.select(registrationColumns).from(stockHistory)
            .innerJoin(colorVariant, eq(stockHistory.colorVariantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .where(and(eq(stockHistory.id, id), inArray(stockHistory.eventType, ASSEMBLY_EVENT_TYPES)))
            .limit(1);

        return result;
    }
}

export default new StockHistoryRepository();
