import { integer, pgTable, unique } from "drizzle-orm/pg-core";

import { designSize } from "../../design/schemas/designSize.schema.js";
import { stockInTransaction } from "./stockInTransaction.schema.js";

// Pieces received individually in a stock-in transaction, not part of any
// bundle and not part of a complete set.
export const stockInLoosePiece = pgTable("stock_in_loose_pieces", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    stockInTransactionId: integer("stock_in_transaction_id")
        .notNull()
        .references(() => stockInTransaction.id, { onDelete: "cascade" }),

    designSizeId: integer("design_size_id")
        .notNull()
        .references(() => designSize.id, { onDelete: "cascade" }),

    quantity: integer("quantity").notNull(),
},
    (table) => ({
        uniqueSizePerTransaction: unique().on(
            table.stockInTransactionId,
            table.designSizeId,
        ),
    }),
);
