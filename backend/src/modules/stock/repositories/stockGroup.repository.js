import { and, eq, inArray, isNull } from "drizzle-orm";
import { stockGroup } from "../schemas/stockGroup.schema.js";

class StockGroupRepository {
    async findById(tx, id) {
        const [result] = await tx.select().from(stockGroup).where(eq(stockGroup.id, id)).limit(1);

        return result;
    }

    async findByIds(tx, ids) {
        if (ids.length === 0) return [];

        return tx.select().from(stockGroup).where(inArray(stockGroup.id, ids));
    }

    // Every distinct composition already used for this variant's BUNDLE groups — the closest
    // thing this app has to a "bundle definition" (see stock_groups_bundle_unique_idx: one row
    // per colorVariantId + compositionSignature). Used by the transformation screen to offer
    // "which existing bundle recipe do you want to assemble more of" rather than letting a
    // caller invent a composition (see stockItem.service.js's assembleBundle).
    async findByColorVariantAndType(tx, colorVariantId, type) {
        return tx.select().from(stockGroup).where(and(eq(stockGroup.colorVariantId, colorVariantId), eq(stockGroup.type, type)));
    }

    async findOrCreate(tx, { colorVariantId, type, compositionSignature = null }) {
        const [inserted] = await tx.insert(stockGroup).values({ colorVariantId, type, compositionSignature }).onConflictDoNothing().returning();

        if (inserted) return inserted;

        return this._findExisting(tx, { colorVariantId, type, compositionSignature });
    }

    async _findExisting(tx, { colorVariantId, type, compositionSignature }) {
        const conditions = [eq(stockGroup.colorVariantId, colorVariantId), eq(stockGroup.type, type)];

        conditions.push(compositionSignature === null
            ? isNull(stockGroup.compositionSignature)
            : eq(stockGroup.compositionSignature, compositionSignature)
        );

        const [existing] = await tx.select().from(stockGroup).where(and(...conditions)).limit(1);

        return existing;
    }
}

export default new StockGroupRepository();
