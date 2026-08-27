import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";

import { design } from "../schemas/design.schema.js";
import { jobber } from "../schemas/jobber.schema.js";
import { colorVariant } from "../schemas/colorVariant.schema.js";
import { designSize } from "../schemas/designSize.schema.js";
import { designSemiSet } from "../schemas/designSemiSet.schema.js";
import { designSemiSetSize } from "../schemas/designSemiSetSize.schema.js";

// Design Master search: code, item name, pattern (design.name), quality, jobber, or any active
// variant's colour — one box, like the mock's.
function searchCondition(keyword) {
    if (!keyword) return undefined;
    const like = `%${keyword}%`;
    return or(
        ilike(design.code, like),
        ilike(design.itemName, like),
        ilike(design.name, like),
        ilike(design.quality, like),
        ilike(jobber.name, like),
        sql`exists (select 1 from ${colorVariant} where ${colorVariant.designId} = ${design.id} and ${colorVariant.isActive} = true and ${colorVariant.colorName} ilike ${like})`,
    );
}

const SORTS = {
    new: [desc(design.createdAt), desc(design.id)],
    old: [asc(design.createdAt), asc(design.id)],
    price_asc: [asc(design.defaultSellingPricePerPiece), desc(design.id)],
    price_desc: [desc(design.defaultSellingPricePerPiece), desc(design.id)],
    code: [asc(design.normalizedCode), asc(design.id)],
};

const designColumns = {
    id: design.id,
    name: design.name,
    patternId: design.patternId,
    code: design.code,
    itemName: design.itemName,
    itemNameId: design.itemNameId,
    quality: design.quality,
    qualityId: design.qualityId,
    jobberId: design.jobberId,
    jobberName: jobber.name,
    defaultCostPricePerPiece: design.defaultCostPricePerPiece,
    defaultSellingPricePerPiece: design.defaultSellingPricePerPiece,
    notes: design.notes,
    createdAt: design.createdAt,
    updatedAt: design.updatedAt,
};

class DesignMasterRepository {
    async findPage(runner, { limit, offset, keyword, sort }) {
        return runner.select(designColumns).from(design)
            .leftJoin(jobber, eq(design.jobberId, jobber.id))
            .where(searchCondition(keyword))
            .orderBy(...(SORTS[sort] ?? SORTS.new))
            .limit(limit)
            .offset(offset);
    }

    async countFiltered(runner, { keyword }) {
        const [result] = await runner.select({ value: count() }).from(design)
            .leftJoin(jobber, eq(design.jobberId, jobber.id))
            .where(searchCondition(keyword));
        return result.value;
    }

    async countAll(runner) {
        const [result] = await runner.select({ value: count() }).from(design);
        return result.value;
    }

    async findDetail(runner, id) {
        const [result] = await runner.select(designColumns).from(design)
            .leftJoin(jobber, eq(design.jobberId, jobber.id))
            .where(eq(design.id, id))
            .limit(1);
        return result;
    }

    async lockDesign(tx, id) {
        const [result] = await tx.select().from(design).where(eq(design.id, id)).limit(1).for("update");
        return result;
    }

    // Another design with the same (pattern, code) identity — editing into it is a duplicate.
    async findOtherByIdentity(runner, { patternId, normalizedCode, excludeId }) {
        if (!normalizedCode) return undefined;
        const [result] = await runner.select({ id: design.id }).from(design)
            .where(and(eq(design.patternId, patternId), eq(design.normalizedCode, normalizedCode), ne(design.id, excludeId)))
            .limit(1);
        return result;
    }

    async updateDesign(tx, id, patch) {
        const [result] = await tx.update(design).set({ ...patch, updatedAt: new Date() }).where(eq(design.id, id)).returning();
        return result;
    }

    async findVariants(runner, designIds, { activeOnly = true } = {}) {
        if (designIds.length === 0) return [];
        const conditions = [inArray(colorVariant.designId, designIds)];
        if (activeOnly) conditions.push(eq(colorVariant.isActive, true));
        return runner.select().from(colorVariant).where(and(...conditions)).orderBy(asc(colorVariant.createdAt), asc(colorVariant.id));
    }

    async updateVariant(tx, id, patch) {
        await tx.update(colorVariant).set({ ...patch, updatedAt: new Date() }).where(eq(colorVariant.id, id));
    }

    // Every size row of the given variants, active or not (an edit may reactivate an old one).
    async findSizes(runner, variantIds) {
        if (variantIds.length === 0) return [];
        return runner.select().from(designSize).where(inArray(designSize.variantId, variantIds))
            .orderBy(asc(designSize.displayOrder), asc(designSize.id));
    }

    async insertSizes(tx, rows) {
        if (rows.length === 0) return [];
        return tx.insert(designSize).values(rows).returning();
    }

    async updateSize(tx, id, patch) {
        await tx.update(designSize).set(patch).where(eq(designSize.id, id));
    }

    // Semi-set definitions of one variant with their size labels (every variant of a design
    // shares the same definitions — see DesignService.registerDesign).
    async findSemiSetsWithLabels(runner, variantId) {
        const rows = await runner.select({
            semiSetId: designSemiSet.id,
            label: designSemiSet.label,
            displayOrder: designSemiSet.displayOrder,
            sizeLabel: designSize.sizeLabel,
            sizeOrder: designSize.displayOrder,
        }).from(designSemiSet)
            .leftJoin(designSemiSetSize, eq(designSemiSetSize.semiSetId, designSemiSet.id))
            .leftJoin(designSize, and(eq(designSemiSetSize.designSizeId, designSize.id), eq(designSize.isActive, true)))
            .where(eq(designSemiSet.variantId, variantId))
            .orderBy(asc(designSemiSet.displayOrder), asc(designSize.displayOrder));

        const byId = new Map();
        for (const row of rows) {
            if (!byId.has(row.semiSetId)) byId.set(row.semiSetId, { label: row.label, displayOrder: row.displayOrder, sizeLabels: [] });
            if (row.sizeLabel) byId.get(row.semiSetId).sizeLabels.push(row.sizeLabel);
        }
        return [...byId.values()];
    }

    // Semi-set definitions are recipes only (nothing else references them), so an edit simply
    // replaces them.
    async deleteSemiSets(tx, variantIds) {
        if (variantIds.length === 0) return;
        await tx.delete(designSemiSet).where(inArray(designSemiSet.variantId, variantIds));
    }
}

export default new DesignMasterRepository();
