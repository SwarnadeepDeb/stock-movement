import { and, count, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";

import { stockItem } from "../schemas/stockItems.schema.js";
import { colorVariant } from "../../design/schemas/colorVariant.schema.js";
import { design } from "../../design/schemas/design.schema.js";
import { designSize } from "../../design/schemas/designSize.schema.js";
import { rack } from "../schemas/rack.schema.js";
import { bin } from "../schemas/bin.schema.js";
import { stockItemQr } from "../schemas/stockItemQr.schema.js";

// Shared by every current-stock aggregate below: CONSUMED source items were transformed into a
// replacement stock item (set/bundle assembly) and must not also be counted themselves — see
// stockItem.service.js (assembleSet/assembleBundle) and stockItemLineage for the transformation.
function isCurrentStock(colorVariantId, type) {
    return and(eq(stockItem.colorVariantId, colorVariantId), eq(stockItem.type, type), ne(stockItem.status, "CONSUMED"));
}

// SET/BUNDLE are the only stock item types a physical label ever gets attached to — a
// LOOSE_PIECE row represents fungible, individually-indistinguishable pieces, so it's
// never QR-eligible (see stockQr.service.js QR_ELIGIBLE_TYPES). CONSUMED items were
// transformed away by an assembly (see isCurrentStock above) and are excluded the same way.
function isQrEligible(keyword) {
    const conditions = [inArray(stockItem.type, ["SET", "BUNDLE"]), ne(stockItem.status, "CONSUMED")];

    if (keyword) {
        conditions.push(or(ilike(design.code, `%${keyword}%`), ilike(design.name, `%${keyword}%`), ilike(colorVariant.colorName, `%${keyword}%`)));
    }

    return and(...conditions);
}

const qrEligibleColumns = {
    stockItemId: stockItem.id,
    type: stockItem.type,
    status: stockItem.status,
    createdAt: stockItem.createdAt,
    colorVariantId: stockItem.colorVariantId,
    colorName: colorVariant.colorName,
    colorHex: colorVariant.colorHex,
    imageUrl: colorVariant.imageUrl,
    designId: design.id,
    designCode: design.code,
    designName: design.name,
};

class StockItemRepository {
    async createMany(tx, rows) {
        if (rows.length === 0) return [];

        return tx.insert(stockItem).values(rows).returning();
    }

    async findById(tx, id) {
        const [result] = await tx.select().from(stockItem).where(eq(stockItem.id, id)).limit(1);
        return result;
    }

    // Full Resolver context for one stock item: design/variant identity, its size (PIECE only),
    // and its current rack/bin placement — every field the QR Center Resolver's SET/PIECE result
    // needs, in one query rather than the Resolver stitching several repositories together.
    async findWithContextById(tx, id) {
        const [result] = await tx.select({
            stockItemId: stockItem.id,
            type: stockItem.type,
            status: stockItem.status,
            stockGroupId: stockItem.stockGroupId,
            colorVariantId: stockItem.colorVariantId,
            designSizeId: stockItem.designSizeId,
            bundleId: stockItem.bundleId,
            rackId: stockItem.rackId,
            binId: stockItem.binId,
            originSetStockItemId: stockItem.originSetStockItemId,
            stockInTransactionId: stockItem.stockInTransactionId,
            createdAt: stockItem.createdAt,
            designId: design.id,
            designCode: design.code,
            designName: design.name,
            defaultSellingPricePerPiece: design.defaultSellingPricePerPiece,
            colorName: colorVariant.colorName,
            colorHex: colorVariant.colorHex,
            sizeLabel: designSize.sizeLabel,
            unsetPricePerSize: designSize.unsetPricePerSize,
            rackCode: rack.code,
            binCode: bin.code,
        }).from(stockItem)
            .innerJoin(colorVariant, eq(stockItem.colorVariantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .leftJoin(designSize, eq(stockItem.designSizeId, designSize.id))
            .leftJoin(rack, eq(stockItem.rackId, rack.id))
            .leftJoin(bin, eq(stockItem.binId, bin.id))
            .where(eq(stockItem.id, id))
            .limit(1);
        return result;
    }

    async findByIds(tx, ids) {
        if (ids.length === 0) return [];
        return tx.select().from(stockItem).where(inArray(stockItem.id, ids));
    }

    // Candidates for a typed label id (see qrDisplayCode.util.js): every item of these types
    // carrying this serial, with the design/colour the caller builds the colour code from. One
    // row per colour variant at most per counter, so this stays small.
    async findBySerial(tx, { serialNo, types }) {
        return tx.select({
            stockItemId: stockItem.id,
            designCode: design.code,
            colorName: colorVariant.colorName,
        }).from(stockItem)
            .innerJoin(colorVariant, eq(stockItem.colorVariantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .where(and(eq(stockItem.serialNo, serialNo), inArray(stockItem.type, types)));
    }

    // Break Set successors — PIECE stock items created out of a broken SET (see
    // originSetStockItemId in stockItems.schema.js), joined to each one's current ACTIVE QR for
    // the Resolver's RETIRED result and the break-set response itself.
    async findSuccessorsByOriginId(tx, originStockItemId) {
        return tx.select({
            stockItemId: stockItem.id,
            sizeLabel: designSize.sizeLabel,
            shortCode: stockItemQr.shortCode,
        }).from(stockItem)
            .leftJoin(designSize, eq(stockItem.designSizeId, designSize.id))
            .leftJoin(stockItemQr, and(eq(stockItemQr.stockItemId, stockItem.id), eq(stockItemQr.status, "ACTIVE")))
            .where(eq(stockItem.originSetStockItemId, originStockItemId));
    }

    async updateLocation(tx, id, { rackId, binId }) {
        const [result] = await tx.update(stockItem).set({ rackId, binId }).where(eq(stockItem.id, id)).returning();
        return result;
    }

    async findByStockInTransactionId(tx, stockInTransactionId) {
        return tx.select().from(stockItem).where(eq(stockItem.stockInTransactionId, stockInTransactionId));
    }

    // "Migration run" bulk generator: SET/BUNDLE stock items that have never had a QR generated
    // at all (no stock_item_qr row of any status) — a stricter/simpler definition than the
    // to-tag registration query above, since this targets individual items directly rather than
    // whole registrations.
    async findUntaggedIds(tx, { limit }) {
        const rows = await tx.select({ stockItemId: stockItem.id }).from(stockItem)
            .leftJoin(stockItemQr, eq(stockItemQr.stockItemId, stockItem.id))
            .where(and(inArray(stockItem.type, ["SET", "BUNDLE"]), ne(stockItem.status, "CONSUMED"), isNull(stockItemQr.id)))
            .groupBy(stockItem.id)
            .limit(limit);
        return rows;
    }

    async updateStatusIfCurrentAndFlippable(tx, id, { form, to, unsetAt }) {
        const [result] = await tx.update(stockItem).set({ status: to, unsetAt }).where(and(eq(stockItem.id, id), eq(stockItem.status, form), inArray(stockItem.type, ["SET", "BUNDLE"]))).returning();

        return result;
    }

    // Ek particular color variant + size ke available loose pieces find karo aur un rows ko lock kar do.
    async findAndLockAvailableBySize(tx, colorVariantId, designSizeId, limit) {
        return tx.select().from(stockItem)
            .where(and(
                eq(stockItem.colorVariantId, colorVariantId),
                eq(stockItem.type, "LOOSE_PIECE"),
                eq(stockItem.status, "UNSET"),
                eq(stockItem.designSizeId, designSizeId),
            ))
            .limit(limit)
            .for("update", { skipLocked: true }); // for update - Jo rows select ki hain, unko current transaction ke liye lock kar do.
    }

    // Ek color variant ke available SET stock items find karo aur lock kar do — Stock Out ke
    // liye, jab poore matched sets bikte hain (assembleSet ki tarah, but sourcing SETs khud,
    // not their loose-piece ingredients).
    async findAndLockAvailableSets(tx, colorVariantId, limit) {
        return tx.select().from(stockItem)
            .where(and(
                eq(stockItem.colorVariantId, colorVariantId),
                eq(stockItem.type, "SET"),
                ne(stockItem.status, "CONSUMED"),
            ))
            .limit(limit)
            .for("update", { skipLocked: true });
    }

    // Ek specific bundle stock group (ek fixed composition) ke available BUNDLE stock items
    // find karo aur lock kar do — Stock Out selling an existing assembled bundle as a whole unit.
    async findAndLockAvailableByStockGroup(tx, stockGroupId, limit) {
        return tx.select().from(stockItem)
            .where(and(
                eq(stockItem.stockGroupId, stockGroupId),
                eq(stockItem.type, "BUNDLE"),
                ne(stockItem.status, "CONSUMED"),
            ))
            .limit(limit)
            .for("update", { skipLocked: true });
    }

    // Turns a variant's complete SETs into semi sets (BUNDLE of the given group) — used when a
    // new size joins the set composition: the existing physical sets don't contain it, so they are
    // no longer complete sets. Their tags, child pieces and piece counts are unchanged.
    async convertSetsToBundles(tx, colorVariantId, bundleGroupId) {
        return tx.update(stockItem)
            .set({ type: "BUNDLE", stockGroupId: bundleGroupId })
            .where(and(eq(stockItem.colorVariantId, colorVariantId), eq(stockItem.type, "SET"), ne(stockItem.status, "CONSUMED")))
            .returning({ id: stockItem.id });
    }

    async markConsumed(tx, ids) {
        if (ids.length === 0) return [];

        return tx.update(stockItem).set({ status: "CONSUMED" }).where(inArray(stockItem.id, ids)).returning();
    }

    // The inverse, used when an owner edits an invoice and a scanned tag is taken off it: the
    // garment was never dispatched, so it goes back on the shelf. Scoped to CONSUMED rows so it
    // can never resurrect an item retired through some other path.
    async markAvailable(tx, ids) {
        if (ids.length === 0) return [];

        return tx.update(stockItem)
            .set({ status: "AVAILABLE" })
            .where(and(inArray(stockItem.id, ids), eq(stockItem.status, "CONSUMED")))
            .returning();
    }

    // QR Center listing: individual SET/BUNDLE stock items (one physical label each), joined
    // with the design/variant identity a printed label needs. Deliberately not aggregated —
    // unlike countAvailableSets/countBundlesByStockGroup below, every eligible row here is a
    // distinct physical unit a QR can be generated for.
    async findQrEligible(tx, { limit, offset, keyword }) {
        return tx.select(qrEligibleColumns).from(stockItem)
            .innerJoin(colorVariant, eq(stockItem.colorVariantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .where(isQrEligible(keyword))
            .orderBy(desc(stockItem.createdAt))
            .limit(limit)
            .offset(offset);
    }

    async countQrEligible(tx, { keyword }) {
        const [result] = await tx.select({ value: count() }).from(stockItem)
            .innerJoin(colorVariant, eq(stockItem.colorVariantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .where(isQrEligible(keyword));

        return result.value;
    }

    // Same eligibility rule as findQrEligible, scoped to a specific set of ids — used by QR
    // generation to both validate the request and fetch the design/variant identity the QR
    // payload needs, in one query.
    async findEligibleByIds(tx, ids) {
        if (ids.length === 0) return [];

        return tx.select(qrEligibleColumns).from(stockItem)
            .innerJoin(colorVariant, eq(stockItem.colorVariantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .where(and(inArray(stockItem.id, ids), inArray(stockItem.type, ["SET", "BUNDLE"]), ne(stockItem.status, "CONSUMED")));
    }

    // One row per physical loose piece, already scoped to its exact designSizeId — no composition
    // explosion needed, unlike SET/BUNDLE below.
    async countLoosePiecesBySize(tx, colorVariantId) {
        return tx.select({
            designSizeId: stockItem.designSizeId,
            pieceCount: count(),
        }).from(stockItem)
            .where(isCurrentStock(colorVariantId, "LOOSE_PIECE"))
            .groupBy(stockItem.designSizeId);
    }

    // A single number: how many current SET stock items this variant has. Each SET row has no
    // designSizeId of its own (it spans every set-eligible size) — the caller explodes this count
    // across the variant's currently active & includedInSet design_sizes.
    async countAvailableSets(tx, colorVariantId) {
        const [result] = await tx.select({ value: count() }).from(stockItem)
            .where(isCurrentStock(colorVariantId, "SET"));

        return result.value;
    }

    // Bundle count grouped by stockGroupId (recipe), NOT by designSizeId — a BUNDLE row has no
    // designSizeId either. The caller pairs this with stockGroup.compositionSignature to explode
    // each group's count into per-size pieces (bundleCount × compositionQuantityForSize).
    async countBundlesByStockGroup(tx, colorVariantId) {
        return tx.select({
            stockGroupId: stockItem.stockGroupId,
            bundleCount: count(),
        }).from(stockItem)
            .where(isCurrentStock(colorVariantId, "BUNDLE"))
            .groupBy(stockItem.stockGroupId);
    }
}

export default new StockItemRepository();
