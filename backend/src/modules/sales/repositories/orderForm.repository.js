import { and, asc, count, desc, eq, exists, ilike, inArray, ne, or, sql } from "drizzle-orm";

import { orderForm } from "../schemas/orderForm.schema.js";
import { orderFormItem } from "../schemas/orderFormItem.schema.js";
import { colorVariant } from "../../design/schemas/colorVariant.schema.js";
import { design } from "../../design/schemas/design.schema.js";
import { db } from "../../../database/index.js";

// Document numbers are compared case- and space-insensitively, so "of-1024" and "OF-1024" are the
// same number written twice. Same shape as the party name rule.
export function normalizeNumber(value) {
    return String(value ?? "").trim().toUpperCase();
}

// Does any line of the order form mention this design code, name or colour? What lets the list be
// searched by "KP100" or "midnight" as well as by number and party.
const hasLineMatching = (like) => exists(
    db.select({ one: sql`1` }).from(orderFormItem)
        .innerJoin(colorVariant, eq(orderFormItem.colorVariantId, colorVariant.id))
        .innerJoin(design, eq(colorVariant.designId, design.id))
        .where(and(
            eq(orderFormItem.orderFormId, orderForm.id),
            or(ilike(design.code, like), ilike(design.name, like), ilike(design.itemName, like), ilike(colorVariant.colorName, like)),
        )),
);

function buildFilters({ keyword, status }) {
    const conditions = [];

    if (status) conditions.push(eq(orderForm.status, status));

    if (keyword) {
        conditions.push(or(
            ilike(orderForm.formNumber, `%${keyword}%`),
            ilike(orderForm.partyName, `%${keyword}%`),
            ilike(orderForm.partyMobile, `%${keyword}%`),
            ilike(orderForm.partyCity, `%${keyword}%`),
            ilike(orderForm.salesman, `%${keyword}%`),
            hasLineMatching(`%${keyword}%`),
        ));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
}

class OrderFormRepository {
    async create(runner, data) {
        const formNumber = String(data.formNumber).trim();

        const [result] = await runner.insert(orderForm).values({
            ...data,
            formNumber,
            normalizedFormNumber: normalizeNumber(formNumber),
        }).returning();

        return result;
    }

    async update(runner, id, data) {
        const patch = { ...data, updatedAt: new Date() };

        if (data.formNumber !== undefined) {
            patch.formNumber = String(data.formNumber).trim();
            patch.normalizedFormNumber = normalizeNumber(patch.formNumber);
        }

        const [result] = await runner.update(orderForm).set(patch).where(eq(orderForm.id, id)).returning();

        return result;
    }

    async setStatus(runner, id, status) {
        const [result] = await runner.update(orderForm)
            .set({ status, updatedAt: new Date() })
            .where(eq(orderForm.id, id))
            .returning();

        return result;
    }

    async findById(runner, id) {
        const [result] = await runner.select().from(orderForm).where(eq(orderForm.id, id)).limit(1);

        return result;
    }

    async findByNumber(runner, formNumber, excludeId) {
        const conditions = [eq(orderForm.normalizedFormNumber, normalizeNumber(formNumber))];
        if (excludeId) conditions.push(ne(orderForm.id, excludeId));

        const [result] = await runner.select().from(orderForm).where(and(...conditions)).limit(1);

        return result;
    }

    async findMany(runner, { limit, offset, keyword, status }) {
        return runner.select().from(orderForm)
            .where(buildFilters({ keyword, status }))
            .orderBy(desc(orderForm.formDate), desc(orderForm.id))
            .limit(limit)
            .offset(offset);
    }

    async count(runner, { keyword, status } = {}) {
        const [result] = await runner.select({ value: count() }).from(orderForm)
            .where(buildFilters({ keyword, status }));

        return result.value;
    }

    // Counts per status for the All / Open / Invoiced tabs, in one query rather than one per tab.
    async countByStatus(runner) {
        return runner.select({ status: orderForm.status, value: sql`count(*)`.mapWith(Number) })
            .from(orderForm).groupBy(orderForm.status);
    }

    // How many order forms each party has, for the Party Master list.
    async countByPartyIds(runner, partyIds) {
        if (partyIds.length === 0) return [];

        return runner.select({ partyId: orderForm.partyId, value: sql`count(*)`.mapWith(Number) })
            .from(orderForm)
            .where(inArray(orderForm.partyId, partyIds))
            .groupBy(orderForm.partyId);
    }

    // The highest number seen so far, for the "Next no." suggestion. Ordering on the numeric tail
    // rather than the string keeps OF-1009 below OF-1010.
    async findHighestNumber(runner, prefix) {
        const [result] = await runner.select({ formNumber: orderForm.formNumber })
            .from(orderForm)
            .where(ilike(orderForm.formNumber, `${prefix}%`))
            .orderBy(desc(sql`nullif(regexp_replace(${orderForm.formNumber}, '\\D', '', 'g'), '')::bigint`))
            .limit(1);

        return result?.formNumber ?? null;
    }

    async replaceItems(runner, orderFormId, items) {
        await runner.delete(orderFormItem).where(eq(orderFormItem.orderFormId, orderFormId));

        if (items.length === 0) return [];

        return runner.insert(orderFormItem).values(items.map((item) => ({
            orderFormId,
            colorVariantId: item.colorVariantId,
            quantityPcs: item.quantityPcs,
        }))).returning();
    }

    // Items joined to their design/variant, so a list or a printed form never needs a second
    // round of lookups per line.
    async findItemsByFormIds(runner, orderFormIds) {
        if (orderFormIds.length === 0) return [];

        return runner.select({
            orderFormId: orderFormItem.orderFormId,
            colorVariantId: orderFormItem.colorVariantId,
            quantityPcs: orderFormItem.quantityPcs,
            colorName: colorVariant.colorName,
            colorHex: colorVariant.colorHex,
            imageUrl: colorVariant.imageUrl,
            designId: design.id,
            designCode: design.code,
            designName: design.name,
            itemName: design.itemName,
            quality: design.quality,
            unitPrice: design.defaultSellingPricePerPiece,
        }).from(orderFormItem)
            .innerJoin(colorVariant, eq(orderFormItem.colorVariantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .where(inArray(orderFormItem.orderFormId, orderFormIds))
            .orderBy(asc(design.code), asc(colorVariant.colorName));
    }

    async countByPartyIds(runner, partyIds) {
        if (partyIds.length === 0) return [];

        return runner.select({ partyId: orderForm.partyId, value: sql`count(*)`.mapWith(Number) })
            .from(orderForm)
            .where(inArray(orderForm.partyId, partyIds))
            .groupBy(orderForm.partyId);
    }
}

export default new OrderFormRepository();
