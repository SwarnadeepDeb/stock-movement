import { index, integer, jsonb, pgTable, timestamp } from "drizzle-orm/pg-core";

import { stockItem } from "./stockItems.schema.js";

export const stockItemQr = pgTable("stock_item_qr", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    // qr history row with no owning physical item is meaningless
    stockItemId: integer("stock_item_id").notNull().references(() => stockItem.id, { onDelete: "cascade" }),

    payload: jsonb("payload").notNull(),

    generatedAt: timestamp("generated_at").defaultNow().notNull(),
},
    (table) => [
        index("stock_item_qr_stock_item_id_idx").on(table.stockItemId)
    ]
);
