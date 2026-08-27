import { integer, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const pattern = pgTable("patterns", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    name: varchar("name", { length: 255 }).notNull(),

    // trim + lowercase (+ collapsed internal whitespace) form of `name`, computed in the
    // repository before insert — backs the unique index below so "Anarkali", "anarkali" and
    // " Anarkali " can't create separate rows.
    normalizedName: varchar("normalized_name", { length: 255 }).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
},
    (table) => [
        uniqueIndex("patterns_normalized_name_unique_idx").on(table.normalizedName),
    ]
);
