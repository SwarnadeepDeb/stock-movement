import { integer, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

// Item Name lookup (e.g. Kurti Pant, Tunic, Co-ord Set) — same shape and rules as qualities.
// Seeded with the default item names; any new name typed on a design is added on save.
// Names are stored in capitals, letters/spaces/hyphens only, max 50 chars — enforced in
// design.validator.js. The column stays 255 wide so older free-text names still fit.
export const itemName = pgTable("item_names", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    name: varchar("name", { length: 255 }).notNull(),

    // trim + lowercase (+ collapsed internal whitespace) form of `name`, computed in the
    // repository before insert — backs the unique index below so "Tunic", "tunic" and
    // " Tunic " can't create separate rows.
    normalizedName: varchar("normalized_name", { length: 255 }).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
},
    (table) => [
        uniqueIndex("item_names_normalized_name_unique_idx").on(table.normalizedName),
    ]
);
