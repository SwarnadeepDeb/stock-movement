import { boolean, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// A real joinable location entity, not a free-text field — QR Center's rack Resolver result
// and Reconcile action need to aggregate stock_items by rack in SQL (expected vs scanned
// counts), which free text can't support.
export const rack = pgTable("racks", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    code: varchar("code", { length: 20 }).notNull().unique(),

    label: varchar("label", { length: 255 }),

    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
});
