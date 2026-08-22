import { stockInBundle } from "../schemas/stockInBundle.schema.js";

class StockInBundleRepository {
    async createMany(tx, rows) {
        return tx.insert(stockInBundle).values(rows).returning();
    }
}

export default new StockInBundleRepository();
