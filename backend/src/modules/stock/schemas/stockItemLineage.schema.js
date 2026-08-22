import { index, integer, pgTable, timestamp, unique } from "drizzle-orm/pg-core";
import { stockItem } from "./stockItems.schema.js";

// Which physical stock items were consumed to create this stock item?

export const stockItemLineage = pgTable("stock_item_lineage", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    resultStockItemId: integer("result_stock_item_id").notNull().references(() => stockItem.id, { onDelete: "cascade" }),

    // which physical pieces were used to create this SET/BUNDLE
    sourceStockItemId: integer("source_stock_item_id").notNull().references(() => stockItem.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
},

    (table) => [
        unique("stock_item_lineage_source_stock_item_id_unique").on(table.sourceStockItemId),

        index("stock_item_lineage_result_stock_item_id_idx").on(table.resultStockItemId),
    ]
);
