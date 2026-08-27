import { integer, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const jobber = pgTable("jobbers", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    name: varchar("name", { length: 255 }).notNull(),

    // trim + lowercase (+ collapsed internal whitespace) form of `name`, computed in the
    // repository before insert — backs the unique index below so "ABC Textiles", "abc textiles"
    // and " ABC Textiles " can't create separate rows.
    normalizedName: varchar("normalized_name", { length: 255 }).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
},
    (table) => [
        uniqueIndex("jobbers_normalized_name_unique_idx").on(table.normalizedName),
    ]
);
