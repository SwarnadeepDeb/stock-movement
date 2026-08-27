import { and, count, desc, eq, ilike, or } from "drizzle-orm";

import { db } from "../../../database/index.js";
import { design } from "../schemas/design.schema.js";
import { jobber } from "../schemas/jobber.schema.js";

// trim + lowercase, so "MB204", "mb204" and " MB204 " all resolve to the same design code.
// Blank/absent code normalizes to null — designs without a code aren't deduplicated (mirrors
// the unique index, which treats each NULL normalizedCode as distinct).
export const normalizeDesignCode = (code) => {
    const trimmed = code?.trim();
    return trimmed ? trimmed.toLowerCase() : null;
};

class DesignRepository {
    async create(tx, data) {
        const [result] = await tx.insert(design).values(data).returning();

        return result;
    }

    // Identity lookup used by DesignService.registerDesign to reject a duplicate submission
    // before creating anything — same pattern + same code is the same design. A null
    // normalizedCode never matches (mirrors the unique index), so codeless designs are never
    // flagged as duplicates.
    async findByIdentity(runner, { patternId, normalizedCode }) {
        if (!normalizedCode) return undefined;

        const [result] = await runner
            .select()
            .from(design)
            .where(and(eq(design.patternId, patternId), eq(design.normalizedCode, normalizedCode)))
            .limit(1);

        return result;
    }

    async findAll({ limit, offset }) {
        return db
            .select()
            .from(design)
            .orderBy(desc(design.createdAt))
            .limit(limit)
            .offset(offset);
    }

    async count() {
        const [result] = await db.select({ value: count() }).from(design);

        return result.value;
    }

    async findById(tx, id) {
        const [result] = await tx.select().from(design).where(eq(design.id, id)).limit(1);
        return result;
    }

    async search(keyword) {
        return await db
            .select({
                id: design.id,
                code: design.code,
                name: design.name,
                quality: design.quality,
                itemName: design.itemName,
                defaultSellingPricePerPiece: design.defaultSellingPricePerPiece,
                jobberId: design.jobberId,
                jobberName: jobber.name,
            })
            .from(design)
            .leftJoin(jobber, eq(design.jobberId, jobber.id))
            .where(or(ilike(design.code, `%${keyword}%`), ilike(design.name, `%${keyword}%`)))
            .limit(20);
    }
}

export default new DesignRepository();
