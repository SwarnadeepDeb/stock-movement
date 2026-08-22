import { index, integer, pgTable, timestamp } from "drizzle-orm/pg-core";

import { printJob } from "./printJob.schema.js";
import { stockItemQr } from "./stockItemQr.schema.js";

// Which QR rows a print job actually printed, in order — the join that answers two questions:
// "reprint range 23-52" (slice by sequence) and the duplicate-print guard's "N of these codes
// were printed 4 minutes ago by X" (recent rows here sharing a shortCode with the codes about
// to be printed now).
export const printJobItem = pgTable("print_job_items", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    printJobId: integer("print_job_id").notNull().references(() => printJob.id, { onDelete: "cascade" }),

    stockItemQrId: integer("stock_item_qr_id").notNull().references(() => stockItemQr.id, { onDelete: "cascade" }),

    sequence: integer("sequence").notNull(),

    printedAt: timestamp("printed_at"),
},
    (table) => [
        index("print_job_items_print_job_id_idx").on(table.printJobId),
        index("print_job_items_stock_item_qr_id_idx").on(table.stockItemQrId),
    ]
);
