import { inArray, sql } from "drizzle-orm";

import { stockItem } from "../schemas/stockItems.schema.js";
import { variantSerialCounter } from "../schemas/variantSerialCounter.schema.js";

class VariantSerialCounterRepository {
    async findByVariantIds(runner, colorVariantIds) {
        if (colorVariantIds.length === 0) return [];

        return runner.select().from(variantSerialCounter).where(inArray(variantSerialCounter.colorVariantId, colorVariantIds));
    }

    // Moves the counters forward by `sets`/`pieces` and returns the first serial of each reserved
    // run. The upsert takes the row lock, so two inwards for the same variant are serialised.
    async reserve(tx, colorVariantId, { sets, pieces }) {
        const [row] = await tx
            .insert(variantSerialCounter)
            .values({ colorVariantId, lastSetSerial: sets, lastPieceSerial: pieces })
            .onConflictDoUpdate({
                target: variantSerialCounter.colorVariantId,
                set: {
                    lastSetSerial: sql`${variantSerialCounter.lastSetSerial} + ${sets}`,
                    lastPieceSerial: sql`${variantSerialCounter.lastPieceSerial} + ${pieces}`,
                },
            })
            .returning();

        return { setStart: row.lastSetSerial - sets + 1, pieceStart: row.lastPieceSerial - pieces + 1 };
    }

    // One UPDATE for the whole inward rather than one per item — a large inward numbers hundreds
    // of items, and each statement is a full round trip to the database.
    async assignSerials(tx, assignments) {
        if (assignments.length === 0) return;

        const cases = assignments.map(({ stockItemId, serialNo }) => sql`when ${stockItemId} then ${serialNo}`);
        await tx.update(stockItem)
            .set({ serialNo: sql`(case ${stockItem.id} ${sql.join(cases, sql` `)} end)::integer` })
            .where(inArray(stockItem.id, assignments.map((row) => row.stockItemId)));
    }
}

export default new VariantSerialCounterRepository();
