import { eq, inArray, sql } from "drizzle-orm";

import { db } from "../../../database/index.js";
import { variantInventory } from "../schemas/variantInventory.schema.js";

class VariantInventoryRepository {
    buildIncrementRows(colorVariantId, delta) {
        return [...delta.entries()].filter(([, quantity]) => quantity > 0)
            .map(([designSizeId, quantity]) => ({
                colorVariantId,
                designSizeId,
                quantity,
            }));
    }

    // `delta` here holds positive quantities *sold* per designSizeId — negated into rows so
    // upsertIncrement's "add on top of existing" semantics subtract instead.
    buildDecrementRows(colorVariantId, delta) {
        return [...delta.entries()].filter(([, quantity]) => quantity > 0)
            .map(([designSizeId, quantity]) => ({
                colorVariantId,
                designSizeId,
                quantity: -quantity,
            }));
    }

    async findByColorVariantId(tx, colorVariantId) {
        return tx.select().from(variantInventory).where(eq(variantInventory.colorVariantId, colorVariantId));
    }

    // Current-total summary source: variant_inventory.quantity already represents total physical
    // pieces per (colorVariantId, designSizeId), so the variant total is just SUM(quantity) grouped
    // by colorVariantId — no join against stock_items/stock_groups/design_sizes needed here.
    async sumQuantityByColorVariantIds(colorVariantIds) {
        if (colorVariantIds.length === 0) return [];

        return db.select({
            colorVariantId: variantInventory.colorVariantId,
            totalPieces: sql`coalesce(sum(${variantInventory.quantity}), 0)::int`.mapWith(Number),
        }).from(variantInventory)
            .where(inArray(variantInventory.colorVariantId, colorVariantIds))
            .groupBy(variantInventory.colorVariantId);
    }

    // `rows` are deltas to add on top of whatever quantity already exists (or 0 if the
    // (colorVariantId, designSizeId) row doesn't exist yet), not absolute quantities.
    async upsertIncrement(tx, rows) {
        return tx.insert(variantInventory).values(rows)
            .onConflictDoUpdate({
                target: [variantInventory.colorVariantId, variantInventory.designSizeId],
                set: {
                    quantity: sql`${variantInventory.quantity} + excluded.quantity`,
                    updatedAt: new Date(),
                },
            })
            .returning();
    }
}

export default new VariantInventoryRepository();
