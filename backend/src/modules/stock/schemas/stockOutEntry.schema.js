import { integer, numeric, pgTable, timestamp } from "drizzle-orm/pg-core";

import { stockOutTransaction } from "./stockOutTransaction.schema.js";
import { colorVariant } from "../../design/schemas/colorVariant.schema.js";
import { designSize } from "../../design/schemas/designSize.schema.js";

export const stockOutEntry = pgTable("stock_out_entries", {
    id: integer("id")
        .primaryKey()
        .generatedAlwaysAsIdentity(),

    stockOutTransactionId: integer("stock_out_transaction_id")
        .notNull()
        .references(() => stockOutTransaction.id, {
            onDelete: "cascade",
        }),

    colorVariantId: integer("color_variant_id")
        .notNull()
        .references(() => colorVariant.id),

    designSizeId: integer("design_size_id")
        .notNull()
        .references(() => designSize.id),

    quantity: integer("quantity")
        .notNull(),

    unitPrice: numeric("unit_price", {
        precision: 10,
        scale: 2,
    }).notNull(),

    createdAt: timestamp("created_at")
        .defaultNow()
        .notNull(),
});