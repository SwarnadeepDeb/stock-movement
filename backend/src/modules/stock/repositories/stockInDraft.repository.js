import { count, desc, eq } from "drizzle-orm";

import { stockInDraft } from "../schemas/stockInDraft.schema.js";

class StockInDraftRepository {
    async findAll(tx) {
        return tx.select().from(stockInDraft).orderBy(desc(stockInDraft.updatedAt));
    }

    async findById(tx, id) {
        const [result] = await tx.select().from(stockInDraft).where(eq(stockInDraft.id, id)).limit(1);
        return result;
    }

    async count(tx) {
        const [result] = await tx.select({ value: count() }).from(stockInDraft);
        return result.value;
    }

    async create(tx, data) {
        const [result] = await tx.insert(stockInDraft).values(data).returning();
        return result;
    }

    async update(tx, id, data) {
        const [result] = await tx.update(stockInDraft)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(stockInDraft.id, id))
            .returning();
        return result;
    }

    async deleteById(tx, id) {
        const [result] = await tx.delete(stockInDraft).where(eq(stockInDraft.id, id)).returning({ id: stockInDraft.id });
        return result;
    }
}

export default new StockInDraftRepository();
