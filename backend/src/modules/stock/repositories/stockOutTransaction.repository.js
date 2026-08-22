import { stockOutTransaction } from "../schemas/stockOutTransaction.schema.js";

class StockOutTransactionRepository {
    async create(tx, data) {
        const [result] = await tx.insert(stockOutTransaction).values(data).returning();

        return result;
    }
}

export default new StockOutTransactionRepository();
