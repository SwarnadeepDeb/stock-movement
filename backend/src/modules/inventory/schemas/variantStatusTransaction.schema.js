import { integer, pgEnum, pgTable, timestamp } from "drizzle-orm/pg-core";

import { colorVariant } from "../../design/schemas/colorVariant.schema.js";
import { stockInTransaction } from "../../stock/schemas/stockInTransaction.schema.js";

// SET: every active designSize for the variant currently has inventory > 0 (sellable as a complete matched set).
// UNSET: at least one active size is at zero (must be sold individually at designSize.unsetPricePerSize).
export const variantStatusEnum = pgEnum("variant_status", ["SET", "UNSET"]);

export const variantStatusTransitionTriggerEnum = pgEnum("variant_status_transition_trigger", [
    "STOCK_IN",
    "STOCK_OUT",
    "MANUAL_ADJUSTMENT",
]);

// Append-only audit log: one row per time a variant's computed SET/UNSET status flips.
export const variantStatusTransaction = pgTable("variant_status_transactions", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    colorVariantId: integer("color_variant_id")
        .notNull()
        .references(() => colorVariant.id, { onDelete: "cascade" }),

    // nullable: future triggers (e.g. stock-out, manual adjustment) won't have a stock-in
    // transaction to point to; "set null" so this audit row survives if the source transaction is removed.
    stockInTransactionId: integer("stock_in_transaction_id")
        .references(() => stockInTransaction.id, { onDelete: "set null" }),

    fromStatus: variantStatusEnum("from_status").notNull(),
    toStatus: variantStatusEnum("to_status").notNull(),

    triggerSource: variantStatusTransitionTriggerEnum("trigger_source").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
});
