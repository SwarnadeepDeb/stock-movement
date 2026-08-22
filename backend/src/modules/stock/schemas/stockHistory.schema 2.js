import { index, integer, jsonb, pgEnum, pgTable, timestamp } from "drizzle-orm/pg-core";

import { colorVariant } from "../../design/schemas/colorVariant.schema.js";
import { stockGroup } from "./stockGroup.schema.js";
import { stockItem } from "./stockItems.schema.js";
import { stockInTransaction } from "./stockInTransaction.schema.js";
import { stockOutTransaction } from "./stockOutTransaction.schema.js";

// Only event types the application can actually produce today. Extend this list in a future
// migration when a new mutation path is implemented — never add a value here speculatively
// ahead of the code that would produce it.
export const stockHistoryEventTypeEnum = pgEnum("stock_history_event_type", [
    "STOCK_IN",
    "SET_ASSEMBLED",
    "BUNDLE_ASSEMBLED",
    "STOCK_OUT",
]);

// Append-only log of stock movement events — what happened, and when, not current state.
// stock_items/variant_inventory already own current state; this table is never updated after
// insert and must never be derived from or reconciled against them.
export const stockHistory = pgTable("stock_history", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    eventType: stockHistoryEventTypeEnum("event_type").notNull(),

    // Every event concerns exactly one color variant. Cascades with the variant like every
    // other stock table (stock_items, stock_groups, stock_in_transactions, ...) — if a variant
    // is ever hard-deleted, all of its stock data (and therefore all history about it) is
    // already gone with it; there is nothing left to preserve history "about".
    colorVariantId: integer("color_variant_id").notNull().references(() => colorVariant.id, { onDelete: "cascade" }),

    // Historical/current-state records these point at can be deleted without destroying this
    // history row's own meaning — set null rather than cascade, so the event row survives.
    stockGroupId: integer("stock_group_id").references(() => stockGroup.id, { onDelete: "set null" }),
    resultStockItemId: integer("result_stock_item_id").references(() => stockItem.id, { onDelete: "set null" }),
    stockInTransactionId: integer("stock_in_transaction_id").references(() => stockInTransaction.id, { onDelete: "set null" }),
    stockOutTransactionId: integer("stock_out_transaction_id").references(() => stockOutTransaction.id, { onDelete: "set null" }),

    // STOCK_IN: total physical pieces added for the variant in this transaction.
    // STOCK_OUT: total physical pieces sold for the variant in this transaction.
    // SET_ASSEMBLED / BUNDLE_ASSEMBLED: always 1 (one resulting unit) — source pieces consumed
    // belong in metadata, not here.
    quantity: integer("quantity").notNull(),

    // Event-specific immutable snapshot (size/bundle/loose breakdown for STOCK_IN; source stock
    // item ids + composition for the assembly events). Never a copy of the full current row.
    metadata: jsonb("metadata"),

    // No user/auth module exists in this application yet. Always null until one does — never
    // fabricate a value here.
    performedBy: integer("performed_by"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
},
    (table) => [
        index("stock_history_event_type_idx").on(table.eventType),
        index("stock_history_color_variant_id_idx").on(table.colorVariantId),
        index("stock_history_created_at_idx").on(table.createdAt),
        // Covers the common "timeline for one variant" access pattern in a single index.
        index("stock_history_color_variant_id_created_at_idx").on(table.colorVariantId, table.createdAt),
    ]
);
