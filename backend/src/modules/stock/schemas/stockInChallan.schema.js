import { date, index, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

// One physical jobber delivery. A single challan can carry many designs/variants, each of which
// is its own stock_in_transaction (linked through stock_in_transactions.challan_id). `serial` is
// our own running number (SF-0001…), issued when the stock-in is COMPLETED — never for a draft —
// and never reused: a dropped challan keeps its serial and status = 'DROPPED'.
export const stockInChallan = pgTable("stock_in_challans", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    serial: integer("serial").notNull().unique(),

    jobberName: varchar("jobber_name", { length: 150 }),

    // The jobber's own delivery challan number, and our issued (job-work) challan number.
    challanNo: varchar("challan_no", { length: 100 }).notNull(),
    issuedChallanNo: varchar("issued_challan_no", { length: 100 }),

    stockDate: date("stock_date").notNull(),

    // QC inspection remarks, and what happens to defective pieces: 'seconds' | 'return'.
    remarks: text("remarks"),
    defectAction: varchar("defect_action", { length: 20 }),

    // 'ACTIVE' | 'DROPPED'
    status: varchar("status", { length: 20 }).default("ACTIVE").notNull(),
    voidReason: text("void_reason"),
    voidedAt: timestamp("voided_at"),

    // No auth module yet — free text, same as stock_adjustments.created_by.
    enteredBy: varchar("entered_by", { length: 100 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
},
    (table) => [
        index("stock_in_challans_stock_date_idx").on(table.stockDate),
        index("stock_in_challans_jobber_name_idx").on(table.jobberName),
    ]
);

// Append-only audit trail for a challan: edits (with a field-level diff), prints, PDF downloads
// and the drop.
export const stockInChallanEvent = pgTable("stock_in_challan_events", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    challanId: integer("challan_id").notNull().references(() => stockInChallan.id, { onDelete: "cascade" }),

    // 'EDIT' | 'PRINT' | 'PDF' | 'DROP'
    kind: varchar("kind", { length: 20 }).notNull(),

    note: text("note"),
    // EDIT only: [{ field, from, to }]
    changes: jsonb("changes"),

    actor: varchar("actor", { length: 100 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
},
    (table) => [index("stock_in_challan_events_challan_id_idx").on(table.challanId)]
);
