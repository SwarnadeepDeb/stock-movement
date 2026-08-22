import { and, eq, inArray } from "drizzle-orm";

import { stockAdjustment } from "../schemas/stockAdjustment.schema.js";
import { stockItem } from "../schemas/stockItems.schema.js";
import { colorVariant } from "../../design/schemas/colorVariant.schema.js";

class StockAdjustmentRepository {
    async create(tx, data) {
        const [result] = await tx.insert(stockAdjustment).values(data).returning();
        return result;
    }

    async findByIdForUpdate(tx, id) {
        const [result] = await tx.select().from(stockAdjustment).where(eq(stockAdjustment.id, id)).limit(1).for("update");
        return result;
    }

    async markReversed(tx, id) {
        const [result] = await tx.update(stockAdjustment).set({ reversedAt: new Date() }).where(eq(stockAdjustment.id, id)).returning();
        return result;
    }

    // Locks the given stock items of one variant for a write-off/reversal — rows that don't
    // belong to the variant are simply not returned, so the caller can detect them by count.
    async lockStockItems(tx, colorVariantId, ids) {
        if (ids.length === 0) return [];
        return tx.select().from(stockItem)
            .where(and(inArray(stockItem.id, ids), eq(stockItem.colorVariantId, colorVariantId)))
            .for("update");
    }

    // Puts written-off items back exactly as they were: one update per previous status.
    async restoreStatuses(tx, previousStatusById) {
        const idsByStatus = new Map();
        for (const [id, status] of Object.entries(previousStatusById)) {
            if (!idsByStatus.has(status)) idsByStatus.set(status, []);
            idsByStatus.get(status).push(Number(id));
        }
        for (const [status, ids] of idsByStatus) {
            await tx.update(stockItem).set({ status }).where(and(inArray(stockItem.id, ids), eq(stockItem.status, "CONSUMED")));
        }
    }

    async lockVariant(tx, colorVariantId) {
        const [result] = await tx.select().from(colorVariant)
            .where(and(eq(colorVariant.id, colorVariantId), eq(colorVariant.isActive, true)))
            .limit(1)
            .for("update");
        return result;
    }

    async updateLowStockLevel(tx, colorVariantId, lowStockLevel) {
        const [result] = await tx.update(colorVariant).set({ lowStockLevel }).where(eq(colorVariant.id, colorVariantId)).returning();
        return result;
    }
}

export default new StockAdjustmentRepository();
