import { and, count, desc, eq } from "drizzle-orm";

import { printJob } from "../schemas/printJob.schema.js";
import { printer } from "../schemas/printer.schema.js";

const listColumns = {
    id: printJob.id,
    jobType: printJob.jobType,
    status: printJob.status,
    totalCount: printJob.totalCount,
    jammedAtCount: printJob.jammedAtCount,
    verifiedAt: printJob.verifiedAt,
    createdBy: printJob.createdBy,
    createdAt: printJob.createdAt,
    printerId: printJob.printerId,
    printerName: printer.name,
};

function buildFilters({ status }) {
    const conditions = [];
    if (status) conditions.push(eq(printJob.status, status));
    return conditions.length > 0 ? and(...conditions) : undefined;
}

class PrintJobRepository {
    async create(tx, data) {
        const [result] = await tx.insert(printJob).values(data).returning();
        return result;
    }

    async findById(tx, id) {
        const [result] = await tx.select().from(printJob).where(eq(printJob.id, id)).limit(1);
        return result;
    }

    async findByIdWithContext(tx, id) {
        const [result] = await tx.select(listColumns).from(printJob)
            .leftJoin(printer, eq(printJob.printerId, printer.id))
            .where(eq(printJob.id, id))
            .limit(1);
        return result;
    }

    async findMany(runner, { status, limit, offset }) {
        return runner.select(listColumns).from(printJob)
            .leftJoin(printer, eq(printJob.printerId, printer.id))
            .where(buildFilters({ status }))
            .orderBy(desc(printJob.createdAt))
            .limit(limit)
            .offset(offset);
    }

    async count(runner, { status }) {
        const [result] = await runner.select({ value: count() }).from(printJob).where(buildFilters({ status }));
        return result.value;
    }

    async countByStatus(runner, status) {
        const [result] = await runner.select({ value: count() }).from(printJob).where(eq(printJob.status, status));
        return result.value;
    }

    // "Verify sample" — flips COMPLETED_UNVERIFIED to COMPLETED once a physical sample has been
    // checked legible. CAS on the current status so a job that's already COMPLETED (or JAMMED)
    // isn't silently overwritten.
    async verify(tx, id) {
        const [result] = await tx.update(printJob)
            .set({ status: "COMPLETED", verifiedAt: new Date() })
            .where(and(eq(printJob.id, id), eq(printJob.status, "COMPLETED_UNVERIFIED")))
            .returning();
        return result;
    }
}

export default new PrintJobRepository();
