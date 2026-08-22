import { boolean, index, integer, pgEnum, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

import { stockItem } from "./stockItems.schema.js";

export const recoveryEntryStatusEnum = pgEnum("recovery_entry_status", ["PENDING", "ASSIGNED"]);

// An orphaned/anonymous physical object found in the godown with no readable or resolvable
// code — Zone 2's Recovery queue. This is the only QR Center flow that can corrupt data (it
// lets an operator claim an existing shortCode for a second physical object), so it carries its
// own supervisorName/acknowledged fields for an audit trail — deliberate UI friction, not real
// RBAC (no auth module exists in this app — see stockHistory.schema.js performedBy).
export const recoveryEntry = pgTable("recovery_entries", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    status: recoveryEntryStatusEnum("status").default("PENDING").notNull(),

    // e.g. "Anonymous bag · 4 pcs" / "Anonymous piece · size M" — free text, entered by whoever
    // found it.
    foundLocation: varchar("found_location", { length: 255 }),
    notes: varchar("notes", { length: 500 }),

    // Set once "Assign identity" completes — the (possibly pre-existing, possibly newly
    // created) stock item this physical object was determined to be.
    assignedStockItemId: integer("assigned_stock_item_id").references(() => stockItem.id, { onDelete: "set null" }),

    supervisorName: varchar("supervisor_name", { length: 100 }),
    acknowledged: boolean("acknowledged").default(false).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
},
    (table) => [
        index("recovery_entries_status_idx").on(table.status),
    ]
);
