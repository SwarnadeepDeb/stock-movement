import { integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

import { design } from "../../design/schemas/design.schema.js";
import { printer } from "./printer.schema.js";

// Per-design label config, surfaced read-only in QR Center's Library & settings accordion.
export const tagPreset = pgTable("tag_presets", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    designId: integer("design_id").notNull().unique().references(() => design.id, { onDelete: "cascade" }),

    presetName: varchar("preset_name", { length: 100 }).notNull(),
    mediaSize: varchar("media_size", { length: 50 }).notNull(),

    defaultPrinterId: integer("default_printer_id").references(() => printer.id, { onDelete: "set null" }),

    // Tag Studio's field-toggle/typography/qrmm/engine/preset state for this design, saved via
    // "Save as preset". Arbitrary shape (see qrTagStudio.js's ActionBar save handler) — a
    // read-only passthrough on this side, never queried by column.
    config: jsonb("config"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
});
