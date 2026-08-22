import { and, eq, ne, sql } from "drizzle-orm";

import { rack } from "../schemas/rack.schema.js";
import { stockItem } from "../schemas/stockItems.schema.js";
import { stockItemQr } from "../schemas/stockItemQr.schema.js";
import { colorVariant } from "../../design/schemas/colorVariant.schema.js";
import { design } from "../../design/schemas/design.schema.js";

class RackRepository {
    async findByCode(tx, code) {
        const [result] = await tx.select().from(rack).where(eq(rack.code, code)).limit(1);
        return result;
    }

    async findById(tx, id) {
        const [result] = await tx.select().from(rack).where(eq(rack.id, id)).limit(1);
        return result;
    }

    async findAll(tx) {
        return tx.select().from(rack).where(eq(rack.isActive, true));
    }

    // Rack Resolve result: every SET currently assigned to this rack is "expected" (it was
    // placed here); "scanned" (still confirmed present) is approximated by still carrying an
    // ACTIVE label — no separate scan-event log exists in this schema, so an ACTIVE QR is the
    // closest available proxy for "physically intact and legible", and a stock item whose QR was
    // retired (most often by Break Set — see qrBreakSet flow in qrCenter.service.js) counts as
    // missing from the rack's sealed-set count.
    async findSetCountsByRackId(tx, rackId) {
        const rows = await tx.select({
            stockItemId: stockItem.id,
            hasActiveQr: sql`bool_or(${stockItemQr.status} = 'ACTIVE')`.mapWith(Boolean),
        }).from(stockItem)
            .leftJoin(stockItemQr, eq(stockItemQr.stockItemId, stockItem.id))
            .where(and(eq(stockItem.rackId, rackId), eq(stockItem.type, "SET"), ne(stockItem.status, "CONSUMED")))
            .groupBy(stockItem.id);

        const expectedSets = rows.length;
        const scannedSets = rows.filter((row) => row.hasActiveQr).length;
        return { expectedSets, scannedSets };
    }

    // Per design/variant breakdown of the rack's still-scanned (ACTIVE-labeled) sets, for the
    // Rack Resolve result's `breakdown` list.
    async findBreakdownByRackId(tx, rackId) {
        return tx.select({
            designCode: design.code,
            colorName: colorVariant.colorName,
            colorHex: colorVariant.colorHex,
            sets: sql`count(distinct ${stockItem.id}) filter (where ${stockItemQr.status} = 'ACTIVE')`.mapWith(Number),
        }).from(stockItem)
            .innerJoin(colorVariant, eq(stockItem.colorVariantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .leftJoin(stockItemQr, eq(stockItemQr.stockItemId, stockItem.id))
            .where(and(eq(stockItem.rackId, rackId), eq(stockItem.type, "SET"), ne(stockItem.status, "CONSUMED")))
            .groupBy(design.code, colorVariant.colorName, colorVariant.colorHex)
            .having(sql`count(distinct ${stockItem.id}) filter (where ${stockItemQr.status} = 'ACTIVE') > 0`);
    }
}

export default new RackRepository();
