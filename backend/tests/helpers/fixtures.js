import { db } from "../../src/database/index.js";
import { design } from "../../src/modules/design/schemas/design.schema.js";
import { colorVariant } from "../../src/modules/design/schemas/colorVariant.schema.js";
import { designSize } from "../../src/modules/design/schemas/designSize.schema.js";
import { stockGroup } from "../../src/modules/stock/schemas/stockGroup.schema.js";
import { stockItem } from "../../src/modules/stock/schemas/stockItems.schema.js";
import { stockItemQr } from "../../src/modules/stock/schemas/stockItemQr.schema.js";
import { variantInventory } from "../../src/modules/inventory/schemas/variantInventory.schema.js";

// Builds a design with one colour variant, four sizes, and real SET / loose PIECE stock items
// each carrying a scannable short code — the minimum a Stock Out test needs to bill something.
export async function seedSellableStock({ designCode = "TST100", sizes = ["S", "M", "L", "XL"], sets = 2, loose = 1, price = 300 } = {}) {
    const [designRow] = await db.insert(design).values({
        name: `${designCode} Test Design`,
        code: designCode,
        normalizedCode: designCode.toLowerCase(),
        defaultSellingPricePerPiece: price,
    }).returning();

    const [variantRow] = await db.insert(colorVariant).values({
        designId: designRow.id,
        colorName: "Test Blue",
        colorHex: "#2563EB",
        normalizedColorName: "test blue",
        imageUrl: "https://example.test/photo.jpg",
        imagePublicId: "test/photo",
        qrPayload: `${designCode}-TSTBLU`,
    }).returning();

    const sizeRows = await db.insert(designSize).values(sizes.map((label, index) => ({
        variantId: variantRow.id,
        sizeLabel: label,
        displayOrder: index,
        includedInSet: true,
    }))).returning();

    const [setGroup] = await db.insert(stockGroup).values({ colorVariantId: variantRow.id, type: "SET" }).returning();

    const setItems = sets > 0 ? await db.insert(stockItem).values(
        Array.from({ length: sets }, () => ({
            stockGroupId: setGroup.id,
            colorVariantId: variantRow.id,
            type: "SET",
            status: "AVAILABLE",
        })),
    ).returning() : [];

    const [looseGroup] = await db.insert(stockGroup).values({
        colorVariantId: variantRow.id,
        type: "PIECE",
        compositionSignature: String(sizeRows[0].id),
    }).returning();

    const looseItems = loose > 0 ? await db.insert(stockItem).values(
        Array.from({ length: loose }, () => ({
            stockGroupId: looseGroup.id,
            colorVariantId: variantRow.id,
            designSizeId: sizeRows[0].id,
            type: "PIECE",
            status: "AVAILABLE",
        })),
    ).returning() : [];

    const allItems = [...setItems, ...looseItems];

    const qrRows = await db.insert(stockItemQr).values(allItems.map((item, index) => ({
        stockItemId: item.id,
        payload: { code: `${designCode}-${index}` },
        shortCode: `${designCode}${String(index).padStart(2, "0")}`,
        status: "ACTIVE",
    }))).returning();

    // Inventory starts at one piece per size per set, plus the loose pieces — the projection the
    // invoice will decrement.
    await db.insert(variantInventory).values(sizeRows.map((size, index) => ({
        colorVariantId: variantRow.id,
        designSizeId: size.id,
        quantity: sets + (index === 0 ? loose : 0),
    })));

    const codeFor = (item) => qrRows.find((qr) => qr.stockItemId === item.id).shortCode;

    return {
        design: designRow,
        variant: variantRow,
        sizes: sizeRows,
        setItems,
        looseItems,
        setCodes: setItems.map(codeFor),
        looseCodes: looseItems.map(codeFor),
        price,
    };
}

// Tables a Stock Out suite owns, in dependency order.
export const SALES_TABLES = [
    "invoice_entries",
    "invoices",
    "order_form_items_v2",
    "order_forms_v2",
    "parties",
    "stock_history",
    "stock_out_entries",
    "stock_out_transactions",
    "stock_item_qr",
    "stock_items",
    "variant_inventory",
    "stock_groups",
    "design_sizes",
    "color_variants",
    "designs",
];
