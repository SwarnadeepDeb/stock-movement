import { integer, pgEnum, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

import { printer } from "./printer.schema.js";

export const printJobTypeEnum = pgEnum("print_job_type", [
    "QR_GENERATE",
    "REPRINT",
    "RACK_BIN_LABEL",
    "TOUR_MANIFEST",
    "VOID",
]);

// QUEUED_OFFLINE: the printer/app had no connection when the job was requested — surfaced in
// the top-bar offline pill precisely so a worker doesn't assume it failed and print again.
// COMPLETED_UNVERIFIED: printed, but nobody has confirmed the physical output is legible yet
// (see "Verify sample" action).
export const printJobStatusEnum = pgEnum("print_job_status", [
    "COMPLETED",
    "JAMMED",
    "QUEUED_OFFLINE",
    "COMPLETED_UNVERIFIED",
]);

export const printJob = pgTable("print_jobs", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    printerId: integer("printer_id").references(() => printer.id, { onDelete: "set null" }),

    jobType: printJobTypeEnum("job_type").notNull(),
    status: printJobStatusEnum("status").notNull(),

    totalCount: integer("total_count").notNull(),
    // Set only when status = JAMMED — how many of totalCount actually printed before the jam,
    // which is what "Reprint range" resumes from.
    jammedAtCount: integer("jammed_at_count"),

    verifiedAt: timestamp("verified_at"),

    // No auth module exists — free text, not a user FK. See stockHistory.schema.js performedBy.
    createdBy: varchar("created_by", { length: 100 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
});
