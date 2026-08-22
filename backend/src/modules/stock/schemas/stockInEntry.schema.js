import { integer, pgTable, timestamp } from "drizzle-orm/pg-core";

import { stockInTransaction } from "./stockInTransaction.schema.js";
import { colorVariant } from "../../design/schemas/colorVariant.schema.js";
import { designSize } from "../../design/schemas/designSize.schema.js";

export const stockInEntry = pgTable("stock_in_entries", {
    id: integer("id")
        .primaryKey()
        .generatedAlwaysAsIdentity(),

    stockInTransactionId: integer("stock_in_transaction_id")
        .notNull()
        .references(() => stockInTransaction.id, {
            onDelete: "cascade",
        }),

    colorVariantId: integer("color_variant_id")
        .notNull()
        .references(() => colorVariant.id),

    designSizeId: integer("design_size_id")
        .notNull()
        .references(() => designSize.id),

    quantityAdded: integer("quantity_added")
        .notNull(),

    createdAt: timestamp("created_at")
        .defaultNow()
        .notNull(),
});
