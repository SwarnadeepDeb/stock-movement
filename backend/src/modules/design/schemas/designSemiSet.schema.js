import { integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { colorVariant } from "./colorVariant.schema.js";

// A named, fixed sub-composition of a variant's full set (e.g. "3-pc: S/M/L" alongside a
// 5-size full set) — jobbers sometimes deliver these instead of a complete set. Which sizes
// make up a given semi set lives in designSemiSetSize.
export const designSemiSet = pgTable("design_semi_sets", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    variantId: integer("variant_id").notNull().references(() => colorVariant.id, { onDelete: "cascade" }),

    label: varchar("label", { length: 100 }).notNull(),

    displayOrder: integer("display_order").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
});
