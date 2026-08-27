import { inArray } from "drizzle-orm";

import { designSemiSetSize } from "../schemas/designSemiSetSize.schema.js";

class DesignSemiSetSizeRepository {
    async createMany(tx, rows) {
        return tx.insert(designSemiSetSize).values(rows).returning();
    }

    async findBySemiSetIds(runner, semiSetIds) {
        if (semiSetIds.length === 0) return [];

        return runner
            .select()
            .from(designSemiSetSize)
            .where(inArray(designSemiSetSize.semiSetId, semiSetIds));
    }
}

export default new DesignSemiSetSizeRepository();
