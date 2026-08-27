import { integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// A Register Design wizard that has been started but not yet registered. Saved on "Save as Draft"
// (and on every step advance) so the Design Master dashboard can list it and the wizard can
// resume it at the exact step it was left on.
export const designDraft = pgTable("design_drafts", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    // 0-based index into the wizard's steps (Design Identity → Variants).
    currentStep: integer("current_step").default(0).notNull(),

    // Denormalized from `state` only so the dashboard list can show/search them without
    // reaching into jsonb — `state` stays the source of truth for resuming.
    designCode: varchar("design_code", { length: 255 }),
    patternName: varchar("pattern_name", { length: 255 }),
    itemName: varchar("item_name", { length: 255 }),

    // The wizard's form values (identity fields, sizes, semi sets, colour variants). Arbitrary
    // shape owned by the frontend's DesignWizard — a passthrough on this side, never queried by
    // field, and re-validated by registerDesignSchema when the design is finally registered.
    state: jsonb("state").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
