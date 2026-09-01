import { date, index, integer, jsonb, numeric, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

import { party } from "./party.schema.js";
import { orderForm } from "./orderForm.schema.js";
import { stockOutTransaction } from "../../stock/schemas/stockOutTransaction.schema.js";

// The document that actually dispatches goods. Generating one is the only thing in Stock Out
// that changes stock.
export const invoice = pgTable("invoices", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    // Typed by hand, like the order form number, and unique on the normalized form.
    invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
    normalizedInvoiceNumber: varchar("normalized_invoice_number", { length: 50 }).notNull(),

    invoiceDate: date("invoice_date").notNull(),

    orderFormId: integer("order_form_id").notNull().references(() => orderForm.id),

    partyId: integer("party_id").references(() => party.id, { onDelete: "set null" }),

    // Frozen party details, for the same reason as on the order form — more so here, since this
    // document is the bill.
    partyName: varchar("party_name", { length: 200 }).notNull(),
    partyMobile: varchar("party_mobile", { length: 20 }),
    partyCity: varchar("party_city", { length: 100 }),
    partyGst: varchar("party_gst", { length: 20 }),
    partyTransport: varchar("party_transport", { length: 200 }),
    partyAgent: varchar("party_agent", { length: 100 }),

    // Copied from the order form when the invoice is generated, so the printed bill keeps the name
    // it was printed with even if the order form is later corrected.
    salesman: varchar("salesman", { length: 60 }),

    // Which checklist lines the picker ticked off in the godown. Purely a record of the picking
    // process — it never affects what was billed, which is derived from the scanned entries.
    ticks: jsonb("ticks"),

    // The stock movement this invoice caused, so stock history and the invoice can be walked
    // between in both directions.
    stockOutTransactionId: integer("stock_out_transaction_id").references(() => stockOutTransaction.id, { onDelete: "set null" }),

    // Both null until RBAC exists — see orderForm.schema.js. The columns stay so that the
    // printed invoice can name a preparer and an editor the moment there are real users.
    preparedBy: varchar("prepared_by", { length: 20 }),
    editedBy: varchar("edited_by", { length: 20 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
},
    (table) => [
        uniqueIndex("invoices_normalized_invoice_number_unique_idx").on(table.normalizedInvoiceNumber),
        index("invoices_order_form_id_idx").on(table.orderFormId),
        index("invoices_party_id_idx").on(table.partyId),
        index("invoices_invoice_date_idx").on(table.invoiceDate),
    ]
);
