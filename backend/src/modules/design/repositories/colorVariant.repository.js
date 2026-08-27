import { and, desc, eq, getTableColumns, ilike, inArray, or, sql } from "drizzle-orm";

import { db } from "../../../database/index.js";
import { colorVariant } from "../schemas/colorVariant.schema.js";
import { design } from "../schemas/design.schema.js";

// trim + lowercase, so "Brown", "brown" and " Brown " all resolve to the same colour on a
// design — backs the unique index on (designId, normalizedColorName).
export const normalizeColorName = (colorName) => colorName.trim().toLowerCase();

// Shared by findDesignsWithActiveVariants/countDesignsWithActiveVariants below so the row set
// behind the page and behind the total always agree.
function buildActiveWithDesignConditions(keyword) {
    const conditions = [eq(colorVariant.isActive, true)];

    if (keyword) {
        conditions.push(or(ilike(design.code, `%${keyword}%`), ilike(design.name, `%${keyword}%`)));
    }

    return and(...conditions);
}

class ColorVariantRepository {
    async createMany(tx, data) {
        return tx.insert(colorVariant).values(data).returning();
    }

    // Design-level page for the Current Stock summary — one row per design (not per variant),
    // grouped by design so its variants can be fetched separately (see findByDesignIds) and nested
    // under it. Ordered by each design's most recently created active variant.
    async findDesignsWithActiveVariants({ limit, offset, keyword }) {
        return db.select({
            designId: design.id,
            designCode: design.code,
            designName: design.name,
        }).from(colorVariant)
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .where(buildActiveWithDesignConditions(keyword))
            .groupBy(design.id, design.code, design.name)
            .orderBy(desc(sql`max(${colorVariant.createdAt})`))
            .limit(limit)
            .offset(offset);
    }

    async countDesignsWithActiveVariants({ keyword }) {
        const [result] = await db.select({ value: sql`count(distinct ${design.id})`.mapWith(Number) })
            .from(colorVariant)
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .where(buildActiveWithDesignConditions(keyword));

        return result.value;
    }

    // All active variants of one design — used by the register-design flow to check which
    // colours already exist on a design whose (pattern, code) matched an existing row.
    async findActiveByDesignId(runner, designId) {
        return runner
            .select()
            .from(colorVariant)
            .where(and(eq(colorVariant.designId, designId), eq(colorVariant.isActive, true)));
    }

    // Every active variant with its design identity, flat rather than grouped — the Gallery's
    // "All designs" mode lists variants, not designs, because a photo belongs to a colourway.
    async findAllActiveWithDesign(runner, { keyword, designId } = {}) {
        const conditions = [eq(colorVariant.isActive, true)];

        if (designId) conditions.push(eq(design.id, Number(designId)));

        if (keyword) {
            conditions.push(or(
                ilike(design.code, `%${keyword}%`),
                ilike(design.name, `%${keyword}%`),
                ilike(colorVariant.colorName, `%${keyword}%`),
            ));
        }

        return runner.select({
            colorVariantId: colorVariant.id,
            colorName: colorVariant.colorName,
            colorHex: colorVariant.colorHex,
            imageUrl: colorVariant.imageUrl,
            designId: design.id,
            designCode: design.code,
            designName: design.name,
            itemName: design.itemName,
            quality: design.quality,
            unitPrice: design.defaultSellingPricePerPiece,
        }).from(colorVariant)
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .where(and(...conditions))
            .orderBy(
                // Searching: best match first — the design whose code was typed, then codes that
                // start with / contain it, then name matches, then colour-only matches — instead
                // of plain A–Z, which buried the searched design under alphabetically earlier
                // designs that only matched on colour.
                ...(keyword
                    ? [sql`case
                        when lower(${design.code}) = lower(${keyword}) then 0
                        when ${design.code} ilike ${`${keyword}%`} then 1
                        when ${design.code} ilike ${`%${keyword}%`} then 2
                        when ${design.name} ilike ${`%${keyword}%`} then 3
                        else 4
                    end`]
                    : []),
                design.code,
                colorVariant.colorName,
            );
    }

    async findByDesignIds(designIds) {
        if (designIds.length === 0) return [];

        return db.select({
            id: colorVariant.id,
            designId: colorVariant.designId,
            colorName: colorVariant.colorName,
            colorHex: colorVariant.colorHex,
            imageUrl: colorVariant.imageUrl,
        }).from(colorVariant)
            .where(and(inArray(colorVariant.designId, designIds), eq(colorVariant.isActive, true)));
    }

    // id/imageUrl/imagePublicId only — used to source the Order Form gallery's auto-added
    // "design photo" for each selected variant (see orderFormPhotoSync.service.js).
    async findByIds(runner, ids) {
        if (ids.length === 0) return [];

        return runner.select({
            id: colorVariant.id,
            imageUrl: colorVariant.imageUrl,
            imagePublicId: colorVariant.imagePublicId,
        }).from(colorVariant)
            .where(inArray(colorVariant.id, ids));
    }

    async findActiveById(tx, id) {
        const [result] = await tx.select({
            ...getTableColumns(colorVariant),
            designCode: design.code,
            designName: design.name,
        }).from(colorVariant)
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .where(and(eq(colorVariant.id, id), eq(colorVariant.isActive, true)))
            .limit(1);

        return result;
    }
}

export default new ColorVariantRepository();
