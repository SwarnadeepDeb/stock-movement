import { index, integer, pgEnum, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

import { stockItem } from "./stockItems.schema.js";
import { rack } from "./rack.schema.js";

export const reprintReasonCodeEnum = pgEnum("reprint_reason_code", [
    "LOST",
    "TORN",
    "FADED",
    "REBAG",
    "JAM",
    "PRICE_CHANGE",
]);

export const reprintRequestStatusEnum = pgEnum("reprint_request_status", ["PENDING", "PRINTED"]);

// A floor-raised, back-office-cleared request — Zone 2's "Reprints pending" queue and its bulk
// "Print batch" action.
export const reprintRequest = pgTable("reprint_requests", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    stockItemId: integer("stock_item_id").notNull().references(() => stockItem.id, { onDelete: "cascade" }),

    reasonCode: reprintReasonCodeEnum("reason_code").notNull(),

    // No auth module exists — free text, not a user FK. See stockHistory.schema.js performedBy.
    raisedBy: varchar("raised_by", { length: 100 }).notNull(),

    // Snapshot of where the tag should return to once printed — not necessarily the item's
    // current rackId if it's moved since the request was raised.
    rackId: integer("rack_id").references(() => rack.id, { onDelete: "set null" }),

    status: reprintRequestStatusEnum("status").default("PENDING").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
},
    (table) => [
        index("reprint_requests_status_idx").on(table.status),
        index("reprint_requests_stock_item_id_idx").on(table.stockItemId),
    ]
);
