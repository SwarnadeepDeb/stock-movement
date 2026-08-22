import { stockInEntry } from "../schemas/stockInEntry.schema.js";

class StockInEntryRepository {
    async createMany(tx, rows) {
        return tx.insert(stockInEntry).values(rows);
    }
}

export default new StockInEntryRepository();
