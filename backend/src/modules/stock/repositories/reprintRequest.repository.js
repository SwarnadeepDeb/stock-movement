import { and, count, desc, eq, inArray } from "drizzle-orm";

import { reprintRequest } from "../schemas/reprintRequest.schema.js";
import { stockItem } from "../schemas/stockItems.schema.js";
import { stockItemQr } from "../schemas/stockItemQr.schema.js";
import { colorVariant } from "../../design/schemas/colorVariant.schema.js";
import { design } from "../../design/schemas/design.schema.js";
import { rack } from "../schemas/rack.schema.js";

const listColumns = {
    id: reprintRequest.id,
    stockItemId: reprintRequest.stockItemId,
    reasonCode: reprintRequest.reasonCode,
    raisedBy: reprintRequest.raisedBy,
    status: reprintRequest.status,
    createdAt: reprintRequest.createdAt,
    rackId: rack.id,
    rackCode: rack.code,
    designId: design.id,
    designCode: design.code,
    designName: design.name,
    colorVariantId: colorVariant.id,
    colorName: colorVariant.colorName,
    colorHex: colorVariant.colorHex,
};

class ReprintRequestRepository {
    async create(tx, data) {
        const [result] = await tx.insert(reprintRequest).values(data).returning();
        return result;
    }

    async findById(tx, id) {
        const [result] = await tx.select().from(reprintRequest).where(eq(reprintRequest.id, id)).limit(1);
        return result;
    }

    async findByIds(tx, ids) {
        if (ids.length === 0) return [];
        return tx.select().from(reprintRequest).where(inArray(reprintRequest.id, ids));
    }

    // Row shape for the Reprints queue — joined through to the stock item's current design/
    // variant/rack identity and its latest QR shortCode (a reprint request is raised against a
    // stock item, but the worker needs to see the code that's actually printed on the shelf).
    async findManyWithContext(runner, { status, limit, offset }) {
        const rows = await runner.select({
            ...listColumns,
            stockItemQrId: stockItemQr.id,
            shortCode: stockItemQr.shortCode,
            qrGeneratedAt: stockItemQr.generatedAt,
        }).from(reprintRequest)
            .innerJoin(stockItem, eq(reprintRequest.stockItemId, stockItem.id))
            .innerJoin(colorVariant, eq(stockItem.colorVariantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .leftJoin(rack, eq(reprintRequest.rackId, rack.id))
            .leftJoin(stockItemQr, and(eq(stockItemQr.stockItemId, stockItem.id), eq(stockItemQr.status, "ACTIVE")))
            .where(status ? eq(reprintRequest.status, status) : undefined)
            .orderBy(desc(reprintRequest.createdAt));

        // A stock item can carry more than one ACTIVE stockItemQr row (see stockItemQr.schema.js
        // and the reprint flow, which deliberately does not retire the prior row) — collapse to
        // the newest one per request rather than the leftJoin fanning a request out into
        // duplicate rows.
        const seen = new Set();
        const deduped = [];
        for (const row of rows.sort((a, b) => new Date(b.qrGeneratedAt ?? 0) - new Date(a.qrGeneratedAt ?? 0))) {
            if (seen.has(row.id)) continue;
            seen.add(row.id);
            deduped.push(row);
        }
        deduped.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return deduped.slice(offset, offset + limit);
    }

    // Single-row version of findManyWithContext, for the create-reprint-request response.
    async findByIdWithContext(runner, id) {
        const rows = await runner.select({
            ...listColumns,
            stockItemQrId: stockItemQr.id,
            shortCode: stockItemQr.shortCode,
            qrGeneratedAt: stockItemQr.generatedAt,
        }).from(reprintRequest)
            .innerJoin(stockItem, eq(reprintRequest.stockItemId, stockItem.id))
            .innerJoin(colorVariant, eq(stockItem.colorVariantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .leftJoin(rack, eq(reprintRequest.rackId, rack.id))
            .leftJoin(stockItemQr, and(eq(stockItemQr.stockItemId, stockItem.id), eq(stockItemQr.status, "ACTIVE")))
            .where(eq(reprintRequest.id, id))
            .orderBy(desc(stockItemQr.generatedAt));

        return rows[0];
    }

    async countByStatus(runner, status) {
        const [result] = await runner.select({ value: count() }).from(reprintRequest).where(status ? eq(reprintRequest.status, status) : undefined);
        return result.value;
    }

    async markPrinted(tx, ids) {
        if (ids.length === 0) return [];
        return tx.update(reprintRequest)
            .set({ status: "PRINTED", resolvedAt: new Date() })
            .where(inArray(reprintRequest.id, ids))
            .returning();
    }
}

export default new ReprintRequestRepository();
