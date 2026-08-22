import { index, integer, jsonb, numeric, pgEnum, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

import { stockItem } from "./stockItems.schema.js";

// ACTIVE: this row is the current label for its stock item (or was, before a newer generation
// event superseded it — "current" is still "latest ACTIVE row by generatedAt", same as before).
// RETIRED: superseded — either a SET broken into pieces (see qrBreakSet.service.js) or a
// reprint that intentionally invalidates the prior physical label. A retired row stays in the
// table forever; it's what lets the Resolver answer "this code used to mean something" instead
// of "not found".
export const stockItemQrStatusEnum = pgEnum("stock_item_qr_status", ["ACTIVE", "RETIRED"]);

export const stockItemQr = pgTable("stock_item_qr", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    // qr history row with no owning physical item is meaningless
    stockItemId: integer("stock_item_id").notNull().references(() => stockItem.id, { onDelete: "cascade" }),

    payload: jsonb("payload").notNull(),

    // Short human-typeable/scannable code (e.g. "S7K2M") — what the QR Center Resolver actually
    // accepts, distinct from the full `payload`. Deliberately NOT unique: the Resolver's
    // Duplicate-conflict result exists to catch two physical objects sharing one code, which a
    // hard unique constraint would make structurally impossible. Generated collision-checked
    // (not collision-enforced) at creation time — see qrShortCode.util.js — so duplicates only
    // arise through a real operational path (Recovery assigning an existing code to a second
    // physical object), never silently.
    shortCode: varchar("short_code", { length: 12 }).notNull(),

    status: stockItemQrStatusEnum("status").default("ACTIVE").notNull(),

    retiredAt: timestamp("retired_at"),
    // Free text reason (e.g. "TOUR", "DISPLAY", "GIFT", "DAMAGE") — see reasonCodes reference,
    // not a foreign key: retirement reasons are a fixed small vocabulary surfaced from
    // /qr-center/reference, not a table of their own.
    retiredReason: varchar("retired_reason", { length: 50 }),

    // Design/size selling price at generation time, snapshotted so staleness (current price !=
    // priceSnapshot) is a plain SQL comparison — never re-derived from payload jsonb.
    priceSnapshot: numeric("price_snapshot", { precision: 10, scale: 2 }),

    // Set by QR Center's "Accept stale" action — this row is known to show an outdated price
    // and that's been acknowledged, so it drops out of the Stale queue without being reprinted.
    priceAcceptedAt: timestamp("price_accepted_at"),

    generatedAt: timestamp("generated_at").defaultNow().notNull(),
},
    (table) => [
        index("stock_item_qr_stock_item_id_idx").on(table.stockItemId),
        index("stock_item_qr_short_code_idx").on(table.shortCode),
        index("stock_item_qr_status_idx").on(table.status),
    ]
);
