import { integer, pgTable } from "drizzle-orm/pg-core";

import { colorVariant } from "../../design/schemas/colorVariant.schema.js";

// Last QR serial handed out per colour variant. Sets/semi sets and individually-tagged pieces
// (child + loose) are two separate runs; both start at 1 and only ever move forward.
export const variantSerialCounter = pgTable("variant_serial_counters", {
    colorVariantId: integer("color_variant_id").primaryKey().references(() => colorVariant.id, { onDelete: "cascade" }),
    lastSetSerial: integer("last_set_serial").default(0).notNull(),
    lastPieceSerial: integer("last_piece_serial").default(0).notNull(),
});
