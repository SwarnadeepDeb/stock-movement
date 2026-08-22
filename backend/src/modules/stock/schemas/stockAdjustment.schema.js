import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

import { colorVariant } from "../../design/schemas/colorVariant.schema.js";

// ADD: pieces added outside Stock In (opening stock, customer return, count correction…).
// REMOVE: pieces written off (damaged, lost, sample…).
// LEVEL: the variant's low-stock level was changed.
// REVERSE: undid an earlier ADD/REMOVE/LEVEL entry (targetAdjustmentId).
export const stockAdjustmentTypeEnum = pgEnum("stock_adjustment_type", ["ADD", "REMOVE", "LEVEL", "REVERSE"]);

// Current Stock's adjustment log — every manual change to stock, kept forever so each one can
// be audited and reversed. ADD/REMOVE entries also update stock_items + variant_inventory and
// record a STOCK_ADJUSTED_IN/OUT stock_history event in the same db transaction.
export const stockAdjustment = pgTable("stock_adjustments", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    colorVariantId: integer("color_variant_id").notNull().references(() => colorVariant.id, { onDelete: "cascade" }),

    type: stockAdjustmentTypeEnum("type").notNull(),

    // Physical pieces added/removed (ADD/REMOVE only; 0 otherwise).
    quantity: integer("quantity").default(0).notNull(),

    reason: varchar("reason", { length: 100 }).notNull(),
    note: text("note"),

    // LEVEL only.
    fromLevel: integer("from_level"),
    toLevel: integer("to_level"),

    // REVERSE only — the entry this one undid.
    targetAdjustmentId: integer("target_adjustment_id").references(() => stockAdjustment.id, { onDelete: "set null" }),
    // Set on an ADD/REMOVE/LEVEL entry once a REVERSE entry has undone it.
    reversedAt: timestamp("reversed_at"),

    // What the entry actually changed, so it can be reversed exactly:
    //   { stockItemIds, previousStatuses: {id: status}, sizeDelta: [{designSizeId, quantity}], kind }
    metadata: jsonb("metadata"),

    // No auth module exists — free text, not a user FK (same as print_jobs.created_by).
    createdBy: varchar("created_by", { length: 100 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
},
    (table) => [
        index("stock_adjustments_color_variant_id_idx").on(table.colorVariantId),
        index("stock_adjustments_created_at_idx").on(table.createdAt),
    ]
);
