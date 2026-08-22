import { integer, pgTable, unique } from "drizzle-orm/pg-core";

import { designSize } from "../../design/schemas/designSize.schema.js";
import { stockInBundle } from "./stockInBundle.schema.js";

// Composition of one bundle: which sizes, how many pieces PER SINGLE BUNDLE.
// Total pieces for a size across all instances of the bundle = stockInBundlePiece.quantity * stockInBundle.quantity
// designSizeId is used directly (not colorVariantId) since designSize is
// already variant-scoped — same single-owning-path rule as elsewhere.
export const stockInBundlePiece = pgTable("stock_in_bundle_pieces", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    bundleId: integer("bundle_id").notNull().references(() => stockInBundle.id, { onDelete: "cascade" }),

    designSizeId: integer("design_size_id").notNull().references(() => designSize.id, { onDelete: "cascade" }),

    quantity: integer("quantity").notNull(), // pieces of this size, per single bundle instance
},
    (table) => ({
        uniqueSizePerBundle: unique().on(table.bundleId, table.designSizeId),
    }),
);
