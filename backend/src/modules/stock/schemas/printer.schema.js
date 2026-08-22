import { boolean, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const printer = pgTable("printers", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    name: varchar("name", { length: 100 }).notNull(),
    model: varchar("model", { length: 100 }),
    location: varchar("location", { length: 100 }),

    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
});
