import { date, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { stockInChallan } from "./stockInChallan.schema.js";
import { colorVariant } from "../../design/schemas/colorVariant.schema.js";

export const stockInTransaction = pgTable("stock_in_transactions", {
    id: integer("id")
        .primaryKey()
        .generatedAlwaysAsIdentity(),

    variantId: integer("variant_id").notNull().references(() => colorVariant.id, { onDelete: "cascade" }),

    // supplierId: integer("supplier_id")
    //     .notNull()
    //     .references(() => supplier.id),

    stockDate: date("stock_date").notNull(),

    // Supplier/delivery challan reference, entered once per registration alongside stockDate —
    // nullable so existing pre-feature transactions stay valid; required for new registrations
    // via stockIn.validator.js, not a NOT NULL constraint here.
    challanNo: text("challan_no"),

    // The jobber delivery (challan) this variant registration belongs to. Nullable only so
    // pre-feature rows survive; the migration back-fills every existing row.
    challanId: integer("challan_id").references(() => stockInChallan.id, { onDelete: "set null" }),

    totalSetsReceived: integer("total_sets_received").notNull(),

    // QC outcome for this variant: pieces that failed inspection, and why.
    defectivePieces: integer("defective_pieces").default(0).notNull(),
    defectCategory: text("defect_category"),

    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
});
