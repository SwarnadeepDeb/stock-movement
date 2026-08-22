import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const stockOutTransaction = pgTable("stock_out_transactions", {
    id: integer("id")
        .primaryKey()
        .generatedAlwaysAsIdentity(),

    // reason: stockOutReasonEnum("reason")
    //     .notNull(),

    // contactId: integer("contact_id")
    //     .references(() => contact.id),

    transactionDate: timestamp("transaction_date")
        .defaultNow()
        .notNull(),

    notes: text("notes"),

    createdAt: timestamp("created_at")
        .defaultNow()
        .notNull(),
});
