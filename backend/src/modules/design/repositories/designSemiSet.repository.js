import { asc, eq, inArray } from "drizzle-orm";

import { designSemiSet } from "../schemas/designSemiSet.schema.js";

class DesignSemiSetRepository {
    async createMany(tx, rows) {
        return tx.insert(designSemiSet).values(rows).returning();
    }

    async findByVariantId(runner, variantId) {
        return runner
            .select()
            .from(designSemiSet)
            .where(eq(designSemiSet.variantId, variantId))
            .orderBy(asc(designSemiSet.displayOrder));
    }

    async findByVariantIds(runner, variantIds) {
        if (variantIds.length === 0) return [];

        return runner
            .select()
            .from(designSemiSet)
            .where(inArray(designSemiSet.variantId, variantIds))
            .orderBy(asc(designSemiSet.displayOrder));
    }
}

export default new DesignSemiSetRepository();
