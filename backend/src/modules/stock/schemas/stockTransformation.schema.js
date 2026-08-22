import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

import { colorVariant } from "../../design/schemas/colorVariant.schema.js";

// BREAK: a set/semi set taken apart into loose pieces (each sent to stock or out with someone).
// FORM: loose pieces bundled into a new set/semi set with a new parent tag.
// MOVE / RETURN: loose tagged pieces going out (display, salesperson, sample, alteration) or back.
// UNDO: reverted an earlier entry (targetTransformationId).
export const stockTransformationTypeEnum = pgEnum("stock_transformation_type", ["BREAK", "FORM", "MOVE", "RETURN", "UNDO"]);

// Stock Transformation's log. Every entry stores a before/after snapshot of every stock item and
// QR row it touched, so an undo restores exactly the prior state — and is refused when any of
// those rows has changed since (the "after" snapshot no longer matches the database).
export const stockTransformation = pgTable("stock_transformations", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    type: stockTransformationTypeEnum("type").notNull(),

    colorVariantId: integer("color_variant_id").notNull().references(() => colorVariant.id, { onDelete: "cascade" }),

    // BREAK: the set broken. FORM: the set created.
    unitStockItemId: integer("unit_stock_item_id"),
    // FORM only: the broken set whose exact pieces were brought back together.
    restoredFromStockItemId: integer("restored_from_stock_item_id"),

    reason: varchar("reason", { length: 150 }),
    note: text("note"),

    // Display data for the log (piece short codes, destinations, sizes…).
    metadata: jsonb("metadata"),
    snapshotBefore: jsonb("snapshot_before").notNull(),
    snapshotAfter: jsonb("snapshot_after").notNull(),

    targetTransformationId: integer("target_transformation_id").references(() => stockTransformation.id, { onDelete: "set null" }),
    undoneAt: timestamp("undone_at"),

    // No auth module exists — free text (same as stock_adjustments.created_by).
    createdBy: varchar("created_by", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
},
    (table) => [
        index("stock_transformations_color_variant_id_idx").on(table.colorVariantId),
        index("stock_transformations_created_at_idx").on(table.createdAt),
    ]
);
