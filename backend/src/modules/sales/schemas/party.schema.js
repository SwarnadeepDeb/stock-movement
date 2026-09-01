import { boolean, integer, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

// A saved customer. Order forms and invoices fill from here and can write changes back, but they
// also keep their own frozen copy of these fields: a printed document must not change because
// someone later corrected a party's transport.
export const party = pgTable("parties", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    name: varchar("name", { length: 200 }).notNull(),

    // trim + lowercase form of `name`, computed in the repository before insert — backs the
    // unique index below, which is what makes "is this an existing party or a new one?"
    // decidable for the party autocomplete.
    normalizedName: varchar("normalized_name", { length: 200 }).notNull(),

    // All nullable: the party form marks only the name required, and a walk-in customer noted at
    // the counter often has no GST number or agent.
    mobile: varchar("mobile", { length: 20 }),
    city: varchar("city", { length: 100 }),
    gst: varchar("gst", { length: 20 }),
    transport: varchar("transport", { length: 200 }),
    agent: varchar("agent", { length: 100 }),

    // Soft delete: parties are referenced by documents, so a hard delete would orphan history.
    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdateFn(() => new Date()),
},
    (table) => [
        uniqueIndex("parties_normalized_name_unique_idx").on(table.normalizedName),
    ]
);
