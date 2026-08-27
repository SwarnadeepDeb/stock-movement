import { boolean, integer, numeric, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { colorVariant } from "./colorVariant.schema.js";

export const designSize = pgTable("design_sizes", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    variantId: integer("variant_id").notNull().references(() => colorVariant.id, { onDelete: "cascade" }),

    sizeLabel: varchar("size_label", { length: 50 }).notNull(),

    displayOrder: integer("display_order").default(0).notNull(),

    unsetPricePerSize: numeric("unset_price_per_size", { precision: 10, scale: 2 }),

    isActive: boolean("is_active").default(true).notNull(),

    // which sizes make up one complete set, decoupled from isActive
    includedInSet: boolean("included_in_set").default(true).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
});
