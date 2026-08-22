import { index, integer, pgEnum, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { colorVariant } from "../../design/schemas/colorVariant.schema.js";
import { sql } from "drizzle-orm";

// PIECE is distinct from LOOSE_PIECE: a LOOSE_PIECE row is pooled/fungible stock (no QR, no
// individual identity). A PIECE row is a single physical piece that has been individually
// QR-tagged — created only by QR Center's "break set" flow (see qrBreakSet.service.js) — and is
// deliberately invisible to every existing SET/BUNDLE/LOOSE_PIECE-scoped query (current-stock
// counts, set-assembly loose pools) since it has physically left the fungible pool.
export const stockGroupTypeEnum = pgEnum("stock_group_type", [ "SET", "BUNDLE", "LOOSE_PIECE", "PIECE" ]);

export const stockGroup = pgTable("stock_groups", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    colorVariantId: integer("color_variant_id").references(() => colorVariant.id, { onDelete: "cascade" }),

    type: stockGroupTypeEnum("type").notNull(),

    compositionSignature: varchar("composition_signature", { length: 500 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
},
    (table) => [
        index("stock_groups_color_variant_id_idx").on(table.colorVariantId),

        uniqueIndex("stock_groups_set_unique_idx").on(table.colorVariantId).where(sql`${table.type} = 'SET'`),

        // One PIECE group per variant — every individually QR-tagged piece for a variant shares
        // it, same rationale as the SET group above (no composition to distinguish groups by).
        uniqueIndex("stock_groups_piece_unique_idx").on(table.colorVariantId).where(sql`${table.type} = 'PIECE'`),

        uniqueIndex("stock_groups_bundle_unique_idx").on(table.colorVariantId, table.compositionSignature).where(sql`${table.type} = 'BUNDLE'`),

        // ensure for same color variant + same size compositionSignature, there is only one loose piece group
        uniqueIndex("stock_groups_loose_piece_unique_idx").on(table.colorVariantId, table.compositionSignature).where(sql`${table.type} = 'LOOSE_PIECE'`),
    ]
);
