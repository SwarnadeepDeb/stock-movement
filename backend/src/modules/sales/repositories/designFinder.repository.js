import { and, asc, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";

import { design } from "../../design/schemas/design.schema.js";
import { colorVariant } from "../../design/schemas/colorVariant.schema.js";
import { designSize } from "../../design/schemas/designSize.schema.js";

// A design is offered only if it has at least one active colour — one with nothing to pick is no
// use on an order form.
const hasActiveVariant = (runner) => exists(
    runner.select({ one: sql`1` }).from(colorVariant)
        .where(and(eq(colorVariant.designId, design.id), eq(colorVariant.isActive, true))),
);

// Does this word appear in the design's code, item name, pattern, quality or in any of its
// colour names? Every typed word has to match somewhere, so "kp100 pink" finds KP100 by its code
// and the pink by its colour.
const tokenMatches = (runner, token) => {
    const like = `%${token}%`;

    return or(
        ilike(design.code, like),
        ilike(design.name, like),
        ilike(design.itemName, like),
        ilike(design.quality, like),
        exists(
            runner.select({ one: sql`1` }).from(colorVariant)
                .where(and(
                    eq(colorVariant.designId, design.id),
                    eq(colorVariant.isActive, true),
                    ilike(colorVariant.colorName, like),
                )),
        ),
    );
};

const designColumns = {
    designId: design.id,
    designCode: design.code,
    // design.name is the pattern (see design.schema.js); itemName is what the shop calls the garment.
    pattern: design.name,
    itemName: design.itemName,
    quality: design.quality,
    unitPrice: design.defaultSellingPricePerPiece,
};

// Reads for the Stock Out design finder: designs matching what was typed, then their colours and
// the sizes that make up a set. Kept apart from the Design Master repositories because it answers a
// selling question (what can I put on an order form?) rather than a registration one.
class DesignFinderRepository {
    // Designs whose code, names or colours contain every token. Ranking happens in the service —
    // it needs the colour names anyway — so this only has to be a generous, bounded superset.
    async findCandidates(runner, { tokens, limit }) {
        const conditions = [hasActiveVariant(runner), ...tokens.map((token) => tokenMatches(runner, token))];

        return runner.select(designColumns).from(design)
            .where(and(...conditions))
            .orderBy(asc(design.code))
            .limit(limit);
    }

    async findByIds(runner, designIds) {
        if (designIds.length === 0) return [];

        return runner.select(designColumns).from(design)
            .where(and(inArray(design.id, designIds), hasActiveVariant(runner)))
            .orderBy(asc(design.code));
    }

    async findActiveVariantsByDesignIds(runner, designIds) {
        if (designIds.length === 0) return [];

        return runner.select({
            colorVariantId: colorVariant.id,
            designId: colorVariant.designId,
            colorName: colorVariant.colorName,
            colorHex: colorVariant.colorHex,
            imageUrl: colorVariant.imageUrl,
        }).from(colorVariant)
            .where(and(inArray(colorVariant.designId, designIds), eq(colorVariant.isActive, true)))
            .orderBy(asc(colorVariant.colorName));
    }

    // The sizes one set of each colour is made of — what the "+1 set" shortcut adds.
    async findSetSizesByVariantIds(runner, variantIds) {
        if (variantIds.length === 0) return [];

        return runner.select({
            variantId: designSize.variantId,
            sizeLabel: designSize.sizeLabel,
        }).from(designSize)
            .where(and(
                inArray(designSize.variantId, variantIds),
                eq(designSize.isActive, true),
                eq(designSize.includedInSet, true),
            ))
            .orderBy(asc(designSize.displayOrder));
    }
}

export default new DesignFinderRepository();
