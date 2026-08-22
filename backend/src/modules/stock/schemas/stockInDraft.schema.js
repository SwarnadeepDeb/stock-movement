import { integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// A Stock In wizard that has been started but not yet confirmed. Saved on every step advance
// (and on "Save as Draft") so the Stock In dashboard can list it and the wizard can resume it
// at the exact step it was left on. Deleted in the same db transaction that registers the
// stock (see stockIn.service.js registerStockIn's draftId), so a confirmed inward never lingers
// as a draft.
export const stockInDraft = pgTable("stock_in_drafts", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    // 0-based index into the wizard's steps (Inward Details → Summary).
    currentStep: integer("current_step").default(0).notNull(),

    // Denormalized from `state` only so the dashboard list can show/search them without
    // reaching into jsonb — `state` stays the source of truth for resuming.
    challanNo: varchar("challan_no", { length: 100 }),
    jobberName: varchar("jobber_name", { length: 150 }),

    // The wizard's full client-side state (selected variants, per-variant configs, QC
    // overrides, tagging strategy…). Arbitrary shape owned by the frontend's StockIn page —
    // a passthrough on this side, never queried by field.
    state: jsonb("state").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
