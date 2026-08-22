import { integer, pgTable, timestamp } from "drizzle-orm/pg-core";
import { stockInTransaction } from "./stockInTransaction.schema.js";

export const stockInBundle = pgTable("stock_in_bundle", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    stockInTransactionId: integer("stock_in_transaction_id").notNull().references(() => stockInTransaction.id, { onDelete: "cascade" }),

    bundleNumber: integer("bundle_number").notNull(),

    quantity: integer("quantity").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
});
