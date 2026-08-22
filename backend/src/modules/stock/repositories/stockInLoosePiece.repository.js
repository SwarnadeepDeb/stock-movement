import { stockInLoosePiece } from "../schemas/stockInLoosePiece.schema.js";

class StockInLoosePieceRepository {
    async createMany(tx, rows) {
        return tx.insert(stockInLoosePiece).values(rows);
    }
}

export default new StockInLoosePieceRepository();
