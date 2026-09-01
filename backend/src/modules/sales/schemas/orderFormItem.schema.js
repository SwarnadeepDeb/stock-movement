import { integer, pgTable, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { orderForm } from "./orderForm.schema.js";
import { colorVariant } from "../../design/schemas/colorVariant.schema.js";

// One line of the customer's requirement: this many pieces of this colour variant. Deliberately
// simpler than the old order_form_items — no per-line pricing and no set/loose split, because
// what is actually dispatched is decided later by scanning, not promised here.
export const orderFormItem = pgTable("order_form_items_v2", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    orderFormId: integer("order_form_id").notNull().references(() => orderForm.id, { onDelete: "cascade" }),

    colorVariantId: integer("color_variant_id").notNull().references(() => colorVariant.id, { onDelete: "cascade" }),

    quantityPcs: integer("quantity_pcs").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
},
    (table) => [
        // One line per variant — the UI merges a re-scanned variant into its existing line rather
        // than adding a second row, and this makes that invariant structural.
        uniqueIndex("order_form_items_v2_form_variant_unique_idx").on(table.orderFormId, table.colorVariantId),
    ]
);
