import { index, integer, jsonb, numeric, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

import { invoice } from "./invoice.schema.js";
import { colorVariant } from "../../design/schemas/colorVariant.schema.js";
import { stockItem } from "../../stock/schemas/stockItems.schema.js";
import { stockGroupTypeEnum } from "../../stock/schemas/stockGroup.schema.js";

// One physically scanned tag. This is the invoice's real content: quantities, size breakdowns,
// "packed as 2 sets + 1 pc" and line amounts on the printed bill are all DERIVED from these rows
// rather than stored, so what was billed and what left the godown cannot disagree.
export const invoiceEntry = pgTable("invoice_entries", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    invoiceId: integer("invoice_id").notNull().references(() => invoice.id, { onDelete: "cascade" }),

    // The physical thing that was scanned. Restricted, not cascaded: a stock item that has been
    // billed must not vanish from the bill.
    stockItemId: integer("stock_item_id").notNull().references(() => stockItem.id),

    colorVariantId: integer("color_variant_id").notNull().references(() => colorVariant.id),

    // SET / BUNDLE / PIECE / LOOSE_PIECE — what kind of tag this was, which is what lets the
    // printed invoice say "2 sets + 1 pc" instead of just a piece count.
    kind: stockGroupTypeEnum("kind").notNull(),

    // The short code as scanned, kept even though stockItemId is authoritative: it is what the
    // picker can match against the physical label when checking a bill.
    scanCode: varchar("scan_code", { length: 32 }).notNull(),

    // How many physical pieces this tag represents: a set's included sizes, a bundle's
    // composition, or 1 for a single piece. Snapshotted because a design's set composition can
    // change later, and this invoice billed the composition as it was.
    pieces: integer("pieces").notNull(),

    // [{ designSizeId, sizeLabel, quantity }] — the per-size breakdown printed on the invoice.
    sizeBreakdown: jsonb("size_breakdown").notNull(),

    // Price per piece at the time of billing, snapshotted for the same reason.
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),

    // "Manual" / "QR Scanner" / "QR Gun" — how the tag got here, which is useful when a
    // mis-picked line has to be explained.
    method: varchar("method", { length: 20 }).notNull(),

    scannedAt: timestamp("scanned_at").defaultNow().notNull(),
},
    (table) => [
        // The same physical item cannot be billed twice on one invoice. Across invoices this is
        // enforced by the stock item's own status, not here.
        uniqueIndex("invoice_entries_invoice_stock_item_unique_idx").on(table.invoiceId, table.stockItemId),
        index("invoice_entries_invoice_id_idx").on(table.invoiceId),
        index("invoice_entries_stock_item_id_idx").on(table.stockItemId),
    ]
);
