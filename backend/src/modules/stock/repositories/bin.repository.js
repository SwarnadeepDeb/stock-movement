import { eq } from "drizzle-orm";

import { bin } from "../schemas/bin.schema.js";

class BinRepository {
    async findById(tx, id) {
        const [result] = await tx.select().from(bin).where(eq(bin.id, id)).limit(1);
        return result;
    }

    async findByCode(tx, code) {
        const [result] = await tx.select().from(bin).where(eq(bin.code, code)).limit(1);
        return result;
    }

    async findAll(tx) {
        return tx.select().from(bin);
    }
}

export default new BinRepository();
