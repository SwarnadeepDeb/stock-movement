import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";

import stockInService from "../../src/modules/stock/services/stockIn.service.js";
import { design } from "../../src/modules/design/schemas/design.schema.js";
import { colorVariant } from "../../src/modules/design/schemas/colorVariant.schema.js";
import { designSize } from "../../src/modules/design/schemas/designSize.schema.js";
import { stockItem } from "../../src/modules/stock/schemas/stockItems.schema.js";
import { db, disconnect, truncate } from "../helpers/db.js";

beforeEach(() => truncate(["stock_in_challans", "designs"]));
afterAll(() => disconnect());

async function seedDesign(code, colours) {
    const [designRow] = await db.insert(design).values({ name: `${code} design`, code, normalizedCode: code.toLowerCase(), defaultSellingPricePerPiece: 300 }).returning();
    const variants = [];
    for (const colorName of colours) {
        const [variant] = await db.insert(colorVariant).values({
            designId: designRow.id, colorName, colorHex: "#2563EB", normalizedColorName: colorName.toLowerCase(),
            imageUrl: "https://example.test/p.jpg", imagePublicId: `t/${colorName}`, qrPayload: `${code}-${colorName}`,
        }).returning();
        const sizes = await db.insert(designSize).values(["S", "M", "L", "XL"].map((label, index) => ({ variantId: variant.id, sizeLabel: label, displayOrder: index, includedInSet: true }))).returning();
        variants.push({ variant, sizes });
    }
    return { design: designRow, variants };
}

let challanCounter = 0;
const inward = (fixture, variantIndex, sets, extra = {}) => stockInService.registerStockIn({
    challan: { jobberName: "Ramesh", challanNo: `DC-${++challanCounter}`, issuedChallanNo: "ISS", stockDate: "2026-09-01", defectAction: "seconds" },
    designs: [{ designId: fixture.design.id, variants: [{
        colorVariantId: fixture.variants[variantIndex].variant.id, totalSetsReceived: sets, bundles: [], loosePieces: [],
        tagging: { strategy: "parentChild", childTagsEnabled: false, tagLoosePieces: false }, ...extra,
    }] }],
});

const serialsOf = async (variantId, type) =>
    (await db.select().from(stockItem).where(eq(stockItem.colorVariantId, variantId)).orderBy(asc(stockItem.id)))
        .filter((item) => item.type === type).map((item) => item.serialNo);

describe("running QR serials per colour variant", () => {
    it("continues pieces after the last serial of the same colour", async () => {
        const fixture = await seedDesign("KP100", ["Green", "Red"]);
        const green = fixture.variants[0].variant.id;

        await inward(fixture, 0, 3); // 3 sets x 4 pieces = 12 pieces
        expect(await serialsOf(green, "PIECE")).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
        expect(await serialsOf(green, "SET")).toEqual([1, 2, 3]);

        await inward(fixture, 0, 2); // 8 more pieces -> 13..20
        const pieces = await serialsOf(green, "PIECE");
        expect(pieces.slice(12)).toEqual(Array.from({ length: 8 }, (_, i) => i + 13));
        expect((await serialsOf(green, "SET")).slice(3)).toEqual([4, 5]);
    });

    it("keeps another colour of the same design on its own run", async () => {
        const fixture = await seedDesign("KP100", ["Green", "Red"]);
        await inward(fixture, 0, 5);
        await inward(fixture, 1, 2);
        expect(await serialsOf(fixture.variants[1].variant.id, "PIECE")).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it("reports the counters and rejects labels printed from stale numbers", async () => {
        const fixture = await seedDesign("KP100", ["Green"]);
        const green = fixture.variants[0].variant.id;
        await inward(fixture, 0, 2);
        expect(await stockInService.getSerialCounters([green])).toEqual([{ colorVariantId: green, lastSetSerial: 2, lastPieceSerial: 8 }]);

        await expect(inward(fixture, 0, 1, { serialStart: { set: 1, piece: 1 } })).rejects.toMatchObject({ code: "QR_SERIAL_CHANGED" });
        // the rejected request rolled back completely
        expect((await stockInService.getSerialCounters([green]))[0].lastPieceSerial).toBe(8);

        await inward(fixture, 0, 1, { serialStart: { set: 3, piece: 9 } });
        expect((await stockInService.getSerialCounters([green]))[0]).toMatchObject({ lastSetSerial: 3, lastPieceSerial: 12 });
    });
});
