import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "../../../database/index.js";
import { designSize } from "../schemas/designSize.schema.js";

class DesignSize {
    async createMany(tx, data) {
        return tx.insert(designSize).values(data).returning();
    }

    async findActiveByVariantId(tx, variantId) {
        return tx
            .select()
            .from(designSize)
            .where(and(eq(designSize.variantId, variantId), eq(designSize.isActive, true)))
            .orderBy(asc(designSize.displayOrder));
    }

    // All active sizes (not just includedInSet ones) for many variants at once — used by Order
    // Forms to build a per-size quantity breakdown for both SET and LOOSE_PIECE line items.
    async findActiveByVariantIds(runner, variantIds) {
        if (variantIds.length === 0) return [];

        return runner.select({
            id: designSize.id,
            variantId: designSize.variantId,
            sizeLabel: designSize.sizeLabel,
            includedInSet: designSize.includedInSet,
            displayOrder: designSize.displayOrder,
        }).from(designSize)
            .where(and(inArray(designSize.variantId, variantIds), eq(designSize.isActive, true)))
            .orderBy(asc(designSize.displayOrder));
    }

    async findByVariantIds(variantIds) {
        if (variantIds.length === 0) return [];

        return db.select({
            id: designSize.id,
            variantId: designSize.variantId,
            sizeLabel: designSize.sizeLabel,
            displayOrder: designSize.displayOrder,
        }).from(designSize)
            .where(and(
                inArray(designSize.variantId, variantIds),
                eq(designSize.isActive, true),
                eq(designSize.includedInSet, true)
            ))
            .orderBy(asc(designSize.displayOrder));
    }
}

export default new DesignSize();