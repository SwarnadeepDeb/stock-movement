import { index, integer, pgTable, timestamp, unique, varchar } from "drizzle-orm/pg-core";

import { rack } from "./rack.schema.js";

// A sub-location under a rack — optional finer-grained placement for a loose piece (a rack
// holds sealed sets; a bin holds broken-out loose pieces within that rack).
export const bin = pgTable("bins", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    rackId: integer("rack_id").references(() => rack.id, { onDelete: "set null" }),

    code: varchar("code", { length: 20 }).notNull(),

    label: varchar("label", { length: 255 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
},
    (table) => [
        unique("bins_code_unique").on(table.code),
        index("bins_rack_id_idx").on(table.rackId),
    ]
);
