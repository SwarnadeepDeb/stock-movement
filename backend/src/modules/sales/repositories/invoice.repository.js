import { and, asc, count, desc, eq, exists, gte, ilike, inArray, lte, ne, or, sql } from "drizzle-orm";

import { invoice } from "../schemas/invoice.schema.js";
import { invoiceEntry } from "../schemas/invoiceEntry.schema.js";
import { orderForm } from "../schemas/orderForm.schema.js";
import { colorVariant } from "../../design/schemas/colorVariant.schema.js";
import { design } from "../../design/schemas/design.schema.js";
import { normalizeNumber } from "./orderForm.repository.js";
import { db } from "../../../database/index.js";

// Does any scanned line of the invoice mention this design code, name or colour?
const hasLineMatching = (like) => exists(
    db.select({ one: sql`1` }).from(invoiceEntry)
        .innerJoin(colorVariant, eq(invoiceEntry.colorVariantId, colorVariant.id))
        .innerJoin(design, eq(colorVariant.designId, design.id))
        .where(and(
            eq(invoiceEntry.invoiceId, invoice.id),
            or(ilike(design.code, like), ilike(design.name, like), ilike(design.itemName, like), ilike(colorVariant.colorName, like)),
        )),
);

function buildFilters({ keyword, from, to }) {
    const conditions = [];

    if (from) conditions.push(gte(invoice.invoiceDate, from));
    if (to) conditions.push(lte(invoice.invoiceDate, to));

    if (keyword) {
        conditions.push(or(
            ilike(invoice.invoiceNumber, `%${keyword}%`),
            ilike(invoice.partyName, `%${keyword}%`),
            ilike(invoice.partyMobile, `%${keyword}%`),
            ilike(invoice.salesman, `%${keyword}%`),
            ilike(orderForm.formNumber, `%${keyword}%`),
            hasLineMatching(`%${keyword}%`),
        ));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
}

class InvoiceRepository {
    async create(runner, data) {
        const invoiceNumber = String(data.invoiceNumber).trim();

        const [result] = await runner.insert(invoice).values({
            ...data,
            invoiceNumber,
            normalizedInvoiceNumber: normalizeNumber(invoiceNumber),
        }).returning();

        return result;
    }

    async update(runner, id, data) {
        const patch = { ...data, updatedAt: new Date() };

        if (data.invoiceNumber !== undefined) {
            patch.invoiceNumber = String(data.invoiceNumber).trim();
            patch.normalizedInvoiceNumber = normalizeNumber(patch.invoiceNumber);
        }

        const [result] = await runner.update(invoice).set(patch).where(eq(invoice.id, id)).returning();

        return result;
    }

    async findById(runner, id) {
        const [result] = await runner.select().from(invoice).where(eq(invoice.id, id)).limit(1);

        return result;
    }

    async findByNumber(runner, invoiceNumber, excludeId) {
        const conditions = [eq(invoice.normalizedInvoiceNumber, normalizeNumber(invoiceNumber))];
        if (excludeId) conditions.push(ne(invoice.id, excludeId));

        const [result] = await runner.select().from(invoice).where(and(...conditions)).limit(1);

        return result;
    }

    async findByOrderFormId(runner, orderFormId) {
        const [result] = await runner.select().from(invoice)
            .where(eq(invoice.orderFormId, orderFormId))
            .orderBy(desc(invoice.id))
            .limit(1);

        return result;
    }

    async findByOrderFormIds(runner, orderFormIds) {
        if (orderFormIds.length === 0) return [];

        return runner.select().from(invoice).where(inArray(invoice.orderFormId, orderFormIds));
    }

    async findMany(runner, { limit, offset, keyword, from, to }) {
        return runner.select({ invoice, orderFormNumber: orderForm.formNumber }).from(invoice)
            .innerJoin(orderForm, eq(invoice.orderFormId, orderForm.id))
            .where(buildFilters({ keyword, from, to }))
            .orderBy(desc(invoice.invoiceDate), desc(invoice.id))
            .limit(limit)
            .offset(offset);
    }

    async count(runner, { keyword, from, to } = {}) {
        const [result] = await runner.select({ value: count() }).from(invoice)
            .innerJoin(orderForm, eq(invoice.orderFormId, orderForm.id))
            .where(buildFilters({ keyword, from, to }));

        return result.value;
    }

    async findHighestNumber(runner, prefix) {
        const [result] = await runner.select({ invoiceNumber: invoice.invoiceNumber })
            .from(invoice)
            .where(ilike(invoice.invoiceNumber, `${prefix}%`))
            .orderBy(desc(sql`nullif(regexp_replace(${invoice.invoiceNumber}, '\\D', '', 'g'), '')::bigint`))
            .limit(1);

        return result?.invoiceNumber ?? null;
    }

    async createEntries(runner, rows) {
        if (rows.length === 0) return [];

        return runner.insert(invoiceEntry).values(rows).returning();
    }

    async deleteEntries(runner, invoiceId) {
        return runner.delete(invoiceEntry).where(eq(invoiceEntry.invoiceId, invoiceId));
    }

    async findEntriesByInvoiceIds(runner, invoiceIds) {
        if (invoiceIds.length === 0) return [];

        return runner.select({
            invoiceId: invoiceEntry.invoiceId,
            stockItemId: invoiceEntry.stockItemId,
            colorVariantId: invoiceEntry.colorVariantId,
            kind: invoiceEntry.kind,
            scanCode: invoiceEntry.scanCode,
            pieces: invoiceEntry.pieces,
            sizeBreakdown: invoiceEntry.sizeBreakdown,
            unitPrice: invoiceEntry.unitPrice,
            method: invoiceEntry.method,
            scannedAt: invoiceEntry.scannedAt,
            colorName: colorVariant.colorName,
            colorHex: colorVariant.colorHex,
            imageUrl: colorVariant.imageUrl,
            designId: design.id,
            designCode: design.code,
            designName: design.name,
            itemName: design.itemName,
            quality: design.quality,
        }).from(invoiceEntry)
            .innerJoin(colorVariant, eq(invoiceEntry.colorVariantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .where(inArray(invoiceEntry.invoiceId, invoiceIds))
            .orderBy(asc(design.code), asc(colorVariant.colorName), asc(invoiceEntry.id));
    }

    // "Is this physical item already on some other invoice?" — the check that stops a garment
    // being sold twice when its stock row was restored by an edit.
    async findEntriesByStockItemIds(runner, stockItemIds, excludeInvoiceId) {
        if (stockItemIds.length === 0) return [];

        const conditions = [inArray(invoiceEntry.stockItemId, stockItemIds)];
        if (excludeInvoiceId) conditions.push(ne(invoiceEntry.invoiceId, excludeInvoiceId));

        return runner.select({
            stockItemId: invoiceEntry.stockItemId,
            invoiceId: invoiceEntry.invoiceId,
            invoiceNumber: invoice.invoiceNumber,
        }).from(invoiceEntry)
            .innerJoin(invoice, eq(invoiceEntry.invoiceId, invoice.id))
            .where(and(...conditions));
    }

    // Month-to-date figures for the Stock Out overview.
    async summarize(runner, { from, to }) {
        const [result] = await runner.select({
            invoices: sql`count(distinct ${invoice.id})`.mapWith(Number),
            pieces: sql`coalesce(sum(${invoiceEntry.pieces}), 0)`.mapWith(Number),
            amount: sql`coalesce(sum(${invoiceEntry.pieces} * ${invoiceEntry.unitPrice}), 0)`.mapWith(Number),
        }).from(invoice)
            .leftJoin(invoiceEntry, eq(invoiceEntry.invoiceId, invoice.id))
            .where(and(gte(invoice.invoiceDate, from), lte(invoice.invoiceDate, to)));

        return result ?? { invoices: 0, pieces: 0, amount: 0 };
    }
}

export default new InvoiceRepository();
