import { eq } from "drizzle-orm";

import { stockInBundlePiece } from "../schemas/stockInBundlePiece.schema.js";

class StockInBundlePieceRepository {
    async createMany(tx, rows) {
        return tx.insert(stockInBundlePiece).values(rows);
    }

    // A bundle's own composition (semi-set aware) — used by qrCenter.service.js#breakSet to
    // fan out to the sizes this specific bundle actually contains, not the variant's full set.
    async findByBundleId(tx, bundleId) {
        return tx.select().from(stockInBundlePiece).where(eq(stockInBundlePiece.bundleId, bundleId));
    }
}

export default new StockInBundlePieceRepository();
