import { date, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

import { party } from "./party.schema.js";

// OPEN: still a checklist, can be edited and invoiced. INVOICED: an invoice has consumed it and
// it is locked. CANCELLED: the customer walked away.
export const orderFormStatusEnum = pgEnum("order_form_status_v2", ["OPEN", "INVOICED", "CANCELLED"]);

// What the customer asked for at the counter. Never touches stock: quantities here may exceed
// what is physically available, and that is not an error.
export const orderForm = pgTable("order_forms_v2", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    // Typed by hand to match the number written in the physical book, not derived from `id` —
    // so the paper and the screen can always be reconciled. Unique on the normalized form.
    formNumber: varchar("form_number", { length: 50 }).notNull(),
    normalizedFormNumber: varchar("normalized_form_number", { length: 50 }).notNull(),

    formDate: date("form_date").notNull(),

    partyId: integer("party_id").references(() => party.id, { onDelete: "set null" }),

    // Frozen copy of the party's details as they were when this document was saved. A printed
    // order form must not change because someone later corrected the party's transport, so these
    // are deliberately not a join. partyId is kept alongside for "all documents for this party".
    partyName: varchar("party_name", { length: 200 }).notNull(),
    partyMobile: varchar("party_mobile", { length: 20 }),
    partyCity: varchar("party_city", { length: 100 }),
    partyGst: varchar("party_gst", { length: 20 }),
    partyTransport: varchar("party_transport", { length: 200 }),
    partyAgent: varchar("party_agent", { length: 100 }),

    // Who took this order at the counter. Free text: there is no staff table to point at.
    salesman: varchar("salesman", { length: 60 }),

    notes: text("notes"),

    status: orderFormStatusEnum("status").default("OPEN").notNull(),

    // Null until RBAC exists. There is no users table and no sign-in, so there is no truthful
    // value to put here; writing a role name would be a fabrication, the same reason
    // stock_history.performed_by stays null.
    preparedBy: varchar("prepared_by", { length: 20 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
},
    (table) => [
        uniqueIndex("order_forms_v2_normalized_form_number_unique_idx").on(table.normalizedFormNumber),
        index("order_forms_v2_party_id_idx").on(table.partyId),
        index("order_forms_v2_status_idx").on(table.status),
    ]
);
