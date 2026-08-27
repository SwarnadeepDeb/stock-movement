import { boolean, integer, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { design } from "./design.schema.js";

export const colorVariant = pgTable("color_variants", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    designId: integer("design_id").notNull().references(() => design.id, { onDelete: "cascade" }),

    colorName: varchar("color_name", { length: 100 }).notNull(),
    colorHex: varchar("color_hex", { length: 7 }).notNull(),

    // trim + lowercase form of `colorName`, computed in the repository before insert — backs
    // the unique index below so a design can't end up with two rows for the same colour.
    normalizedColorName: varchar("normalized_color_name", { length: 100 }).notNull(),

    // every color variant must have exactly one image (business rule) — NOT NULL accordingly
    imageUrl: varchar("image_url", { length: 500 }).notNull(),
    imagePublicId: varchar("image_public_id", { length: 255 }).notNull(),

    qrPayload: varchar("qr_payload", { length: 255 }).notNull(),
    qrGeneratedAt: timestamp("qr_generated_at"),

    isActive: boolean("is_active").default(true).notNull(),

    // Current Stock marks this variant "Low" once its pieces in stock fall to this number or
    // below (but above 0). Edited from the Current Stock drawer; every change is logged as a
    // LEVEL stock_adjustments row so it can be reversed.
    lowStockLevel: integer("low_stock_level").default(5).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdateFn(() => new Date()),
},
    (table) => [
        uniqueIndex("color_variants_design_id_normalized_color_name_unique_idx").on(table.designId, table.normalizedColorName),
    ]
);
