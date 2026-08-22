import { stockOutEntry } from "../schemas/stockOutEntry.schema.js";

class StockOutEntryRepository {
    async createMany(tx, rows) {
        if (rows.length === 0) return [];

        return tx.insert(stockOutEntry).values(rows).returning();
    }
}

export default new StockOutEntryRepository();
