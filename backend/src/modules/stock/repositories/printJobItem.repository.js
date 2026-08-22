import { and, eq, gte, inArray } from "drizzle-orm";

import { printJobItem } from "../schemas/printJobItem.schema.js";
import { printJob } from "../schemas/printJob.schema.js";
import { printer } from "../schemas/printer.schema.js";
import { stockItemQr } from "../schemas/stockItemQr.schema.js";

class PrintJobItemRepository {
    async createMany(tx, rows) {
        if (rows.length === 0) return [];
        return tx.insert(printJobItem).values(rows).returning();
    }

    async findByJobId(tx, printJobId) {
        return tx.select().from(printJobItem).where(eq(printJobItem.printJobId, printJobId));
    }

    // "Reprint range" — the slice of one job's printed items whose sequence falls in
    // [fromSeq, toSeq], joined to the stockItemQr row each one printed (the reprint needs to
    // know which stock item / shortCode each sequence number belonged to).
    async findByJobIdAndSeqRange(tx, printJobId, fromSeq, toSeq) {
        return tx.select({
            id: printJobItem.id,
            sequence: printJobItem.sequence,
            stockItemQrId: printJobItem.stockItemQrId,
            stockItemId: stockItemQr.stockItemId,
            shortCode: stockItemQr.shortCode,
            payload: stockItemQr.payload,
            priceSnapshot: stockItemQr.priceSnapshot,
        }).from(printJobItem)
            .innerJoin(stockItemQr, eq(printJobItem.stockItemQrId, stockItemQr.id))
            .where(and(
                eq(printJobItem.printJobId, printJobId),
                gte(printJobItem.sequence, fromSeq),
                gte(toSeq, printJobItem.sequence),
            ));
    }

    // Duplicate-print guard (print-check) and the Resolver's DUPLICATE result both need "who
    // printed this label and when, most recently" — one row per requested stockItemQrId, newest
    // print first, joined to the job that produced it for createdBy/id.
    async findRecentByQrIds(runner, stockItemQrIds, since) {
        if (stockItemQrIds.length === 0) return [];

        const conditions = [inArray(printJobItem.stockItemQrId, stockItemQrIds)];
        if (since) conditions.push(gte(printJobItem.printedAt, since));

        return runner.select({
            stockItemQrId: printJobItem.stockItemQrId,
            printJobId: printJob.id,
            printedAt: printJobItem.printedAt,
            printedBy: printJob.createdBy,
            printerName: printer.name,
        }).from(printJobItem)
            .innerJoin(printJob, eq(printJobItem.printJobId, printJob.id))
            .leftJoin(printer, eq(printJob.printerId, printer.id))
            .where(and(...conditions));
    }
}

export default new PrintJobItemRepository();
