import { desc, eq } from "drizzle-orm";

import { recoveryEntry } from "../schemas/recoveryEntry.schema.js";

class RecoveryEntryRepository {
    async create(tx, data) {
        const [result] = await tx.insert(recoveryEntry).values(data).returning();
        return result;
    }

    async findById(tx, id) {
        const [result] = await tx.select().from(recoveryEntry).where(eq(recoveryEntry.id, id)).limit(1);
        return result;
    }

    async findMany(runner, { status }) {
        return runner.select().from(recoveryEntry)
            .where(status ? eq(recoveryEntry.status, status) : undefined)
            .orderBy(desc(recoveryEntry.createdAt));
    }

    async assign(tx, id, { assignedStockItemId, supervisorName, acknowledged }) {
        const [result] = await tx.update(recoveryEntry)
            .set({ status: "ASSIGNED", assignedStockItemId, supervisorName, acknowledged, resolvedAt: new Date() })
            .where(eq(recoveryEntry.id, id))
            .returning();
        return result;
    }
}

export default new RecoveryEntryRepository();
