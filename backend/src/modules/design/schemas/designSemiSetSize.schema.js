import { integer, pgTable, unique } from "drizzle-orm/pg-core";

import { designSize } from "./designSize.schema.js";
import { designSemiSet } from "./designSemiSet.schema.js";

// Composition of one semi set: which of the variant's sizes it includes, one piece each — same
// single-piece-per-size shape as a full set (designSize.includedInSet), just a smaller subset.
export const designSemiSetSize = pgTable("design_semi_set_sizes", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    semiSetId: integer("semi_set_id").notNull().references(() => designSemiSet.id, { onDelete: "cascade" }),

    designSizeId: integer("design_size_id").notNull().references(() => designSize.id, { onDelete: "cascade" }),
},
    (table) => ({
        uniqueSizePerSemiSet: unique().on(table.semiSetId, table.designSizeId),
    }),
);
