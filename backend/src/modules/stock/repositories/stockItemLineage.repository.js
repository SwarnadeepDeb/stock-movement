import { eq } from "drizzle-orm";

import { stockItemLineage } from "../schemas/stockItemLineage.schema.js";

class StockItemLineageRepository {
    async createMany(tx, rows) {
        if (rows.length === 0) return [];

        return tx.insert(stockItemLineage).values(rows).returning();
    }

    async findSourcesByResultId(tx, resultStockItemId) {
        return tx.select().from(stockItemLineage).where(eq(stockItemLineage.resultStockItemId, resultStockItemId));
    }
}

export default new StockItemLineageRepository();
