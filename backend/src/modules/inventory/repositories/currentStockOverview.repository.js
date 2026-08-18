import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";

import { colorVariant } from "../../design/schemas/colorVariant.schema.js";
import { design } from "../../design/schemas/design.schema.js";
import { designSize } from "../../design/schemas/designSize.schema.js";
import { variantInventory } from "../schemas/variantInventory.schema.js";
import { stockItem } from "../../stock/schemas/stockItems.schema.js";
import { stockItemQr } from "../../stock/schemas/stockItemQr.schema.js";
import { stockInTransaction } from "../../stock/schemas/stockInTransaction.schema.js";
import { stockOutTransaction } from "../../stock/schemas/stockOutTransaction.schema.js";
import { stockHistory } from "../../stock/schemas/stockHistory.schema.js";
import { stockAdjustment } from "../../stock/schemas/stockAdjustment.schema.js";

// A stock item that is its own unit of stock right now: a SET, a BUNDLE (shown as "semi set"),
// a LOOSE_PIECE, or a PIECE not currently inside a set (an individually-tagged loose piece — out
// with someone or not). A PIECE WITH a parentStockItemId is a child tag inside a SET/BUNDLE that
// is counted as that unit, so it's never counted again on its own. CONSUMED items were sold,
// assembled away, broken apart or written off.
const countsAsOwnUnit = and(
    ne(stockItem.status, "CONSUMED"),
    or(inArray(stockItem.type, ["SET", "BUNDLE", "LOOSE_PIECE"]), and(eq(stockItem.type, "PIECE"), isNull(stockItem.parentStockItemId))),
);

// When the item physically arrived: its Stock In challan date when it came through Stock In,
// otherwise the day the item row was created (adjustments, assemblies, recovery).
const receivedOnSql = sql`coalesce(${stockInTransaction.stockDate}, ${stockItem.createdAt}::date)`;

// Latest ACTIVE QR short code for a stock item (a stock item can carry QR history rows).
const activeShortCodeSql = sql`(select ${stockItemQr.shortCode} from ${stockItemQr} where ${stockItemQr.stockItemId} = ${stockItem.id} and ${stockItemQr.status} = 'ACTIVE' order by ${stockItemQr.generatedAt} desc limit 1)`;

class CurrentStockOverviewRepository {
    async findActiveVariants(tx, { colorVariantId, colorVariantIds } = {}) {
        const conditions = [eq(colorVariant.isActive, true)];
        if (colorVariantId) conditions.push(eq(colorVariant.id, colorVariantId));
        if (colorVariantIds) conditions.push(inArray(colorVariant.id, colorVariantIds.length ? colorVariantIds : [-1]));

        return tx.select({
            colorVariantId: colorVariant.id,
            colorName: colorVariant.colorName,
            colorHex: colorVariant.colorHex,
            imageUrl: colorVariant.imageUrl,
            lowStockLevel: colorVariant.lowStockLevel,
            designId: design.id,
            designCode: design.code,
            designName: design.name,
            sellingPricePerPiece: design.defaultSellingPricePerPiece,
        }).from(colorVariant)
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .where(and(...conditions))
            .orderBy(asc(design.code), asc(colorVariant.colorName));
    }

    async findActiveSizes(tx, variantIds) {
        if (variantIds.length === 0) return [];
        return tx.select({
            id: designSize.id,
            variantId: designSize.variantId,
            sizeLabel: designSize.sizeLabel,
            displayOrder: designSize.displayOrder,
            includedInSet: designSize.includedInSet,
        }).from(designSize)
            .where(and(inArray(designSize.variantId, variantIds), eq(designSize.isActive, true)))
            .orderBy(asc(designSize.displayOrder), asc(designSize.id));
    }

    async findInventory(tx, variantIds) {
        if (variantIds.length === 0) return [];
        return tx.select({
            colorVariantId: variantInventory.colorVariantId,
            designSizeId: variantInventory.designSizeId,
            quantity: variantInventory.quantity,
        }).from(variantInventory)
            .where(inArray(variantInventory.colorVariantId, variantIds));
    }

    // Own-unit stock items per variant/type/group/size, with the oldest arrival date — what
    // Current Stock counts pieces from (see currentStockOverview.service.js _buildVariantRows).
    async countUnits(tx, variantIds) {
        if (variantIds.length === 0) return [];
        return tx.select({
            colorVariantId: stockItem.colorVariantId,
            type: stockItem.type,
            stockGroupId: stockItem.stockGroupId,
            // Set only for LOOSE_PIECE/PIECE rows — SET/BUNDLE span several sizes.
            designSizeId: stockItem.designSizeId,
            unitCount: sql`count(*)`.mapWith(Number),
            oldestReceivedOn: sql`min(${receivedOnSql})`.mapWith(String),
        }).from(stockItem)
            .leftJoin(stockInTransaction, eq(stockItem.stockInTransactionId, stockInTransaction.id))
            .where(and(inArray(stockItem.colorVariantId, variantIds), countsAsOwnUnit))
            .groupBy(stockItem.colorVariantId, stockItem.type, stockItem.stockGroupId, stockItem.designSizeId);
    }

    // Every own-unit stock item of one variant, for the drawer's "Tags in stock" list.
    async findUnitsForVariant(tx, colorVariantId) {
        return tx.select({
            stockItemId: stockItem.id,
            type: stockItem.type,
            status: stockItem.status,
            stockGroupId: stockItem.stockGroupId,
            designSizeId: stockItem.designSizeId,
            receivedOn: receivedOnSql.mapWith(String),
            challanNo: stockInTransaction.challanNo,
            shortCode: activeShortCodeSql,
        }).from(stockItem)
            .leftJoin(stockInTransaction, eq(stockItem.stockInTransactionId, stockInTransaction.id))
            .where(and(eq(stockItem.colorVariantId, colorVariantId), countsAsOwnUnit))
            .orderBy(asc(stockItem.type), asc(stockItem.id));
    }

    // Child tags (Parent+Child tagging) of the given SET/BUNDLE units.
    async findChildTags(tx, parentIds) {
        if (parentIds.length === 0) return [];
        return tx.select({
            stockItemId: stockItem.id,
            parentId: stockItem.parentStockItemId,
            designSizeId: stockItem.designSizeId,
            shortCode: activeShortCodeSql,
        }).from(stockItem)
            .where(and(inArray(stockItem.parentStockItemId, parentIds), eq(stockItem.type, "PIECE"), ne(stockItem.status, "CONSUMED")))
            .orderBy(asc(stockItem.id));
    }

    async findHistoryForVariant(tx, colorVariantId, { limit }) {
        return tx.select({
            id: stockHistory.id,
            eventType: stockHistory.eventType,
            quantity: stockHistory.quantity,
            metadata: stockHistory.metadata,
            createdAt: stockHistory.createdAt,
            challanNo: stockInTransaction.challanNo,
            stockDate: stockInTransaction.stockDate,
            stockOutNotes: stockOutTransaction.notes,
        }).from(stockHistory)
            .leftJoin(stockInTransaction, eq(stockHistory.stockInTransactionId, stockInTransaction.id))
            .leftJoin(stockOutTransaction, eq(stockHistory.stockOutTransactionId, stockOutTransaction.id))
            .where(eq(stockHistory.colorVariantId, colorVariantId))
            .orderBy(desc(stockHistory.createdAt), desc(stockHistory.id))
            .limit(limit);
    }

    async findAdjustments(tx, { colorVariantId, limit }) {
        return tx.select({
            id: stockAdjustment.id,
            type: stockAdjustment.type,
            quantity: stockAdjustment.quantity,
            reason: stockAdjustment.reason,
            note: stockAdjustment.note,
            fromLevel: stockAdjustment.fromLevel,
            toLevel: stockAdjustment.toLevel,
            targetAdjustmentId: stockAdjustment.targetAdjustmentId,
            reversedAt: stockAdjustment.reversedAt,
            metadata: stockAdjustment.metadata,
            createdBy: stockAdjustment.createdBy,
            createdAt: stockAdjustment.createdAt,
            colorVariantId: colorVariant.id,
            colorName: colorVariant.colorName,
            colorHex: colorVariant.colorHex,
            designId: design.id,
            designCode: design.code,
            designName: design.name,
        }).from(stockAdjustment)
            .innerJoin(colorVariant, eq(stockAdjustment.colorVariantId, colorVariant.id))
            .innerJoin(design, eq(colorVariant.designId, design.id))
            .where(colorVariantId ? eq(stockAdjustment.colorVariantId, colorVariantId) : undefined)
            .orderBy(desc(stockAdjustment.createdAt), desc(stockAdjustment.id))
            .limit(limit);
    }

    // Tag lookup for the search box: an ACTIVE QR short code → the variant it belongs to.
    async findVariantByShortCode(tx, shortCode) {
        const [result] = await tx.select({
            colorVariantId: stockItem.colorVariantId,
            stockItemId: stockItem.id,
            parentId: stockItem.parentStockItemId,
        }).from(stockItemQr)
            .innerJoin(stockItem, eq(stockItemQr.stockItemId, stockItem.id))
            .where(and(sql`upper(${stockItemQr.shortCode}) = upper(${shortCode})`, eq(stockItemQr.status, "ACTIVE")))
            .orderBy(desc(stockItemQr.generatedAt))
            .limit(1);
        return result;
    }
}

export default new CurrentStockOverviewRepository();
