import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import stockInService from "../../src/modules/stock/services/stockIn.service.js";
import stockInChallanService from "../../src/modules/stock/services/stockInChallan.service.js";
import { design } from "../../src/modules/design/schemas/design.schema.js";
import { colorVariant } from "../../src/modules/design/schemas/colorVariant.schema.js";
import { designSize } from "../../src/modules/design/schemas/designSize.schema.js";
import { variantInventory } from "../../src/modules/inventory/schemas/variantInventory.schema.js";
import { stockItem } from "../../src/modules/stock/schemas/stockItems.schema.js";
import { db, disconnect, truncate } from "../helpers/db.js";

beforeEach(() => truncate(["stock_in_challans", "designs"]));
afterAll(() => disconnect());

async function seedDesign(code) {
    const [designRow] = await db.insert(design).values({ name: `${code} design`, code, normalizedCode: code.toLowerCase(), defaultSellingPricePerPiece: 300 }).returning();
    const [variant] = await db.insert(colorVariant).values({
        designId: designRow.id, colorName: "Blue", colorHex: "#2563EB", normalizedColorName: "blue",
        imageUrl: "https://example.test/p.jpg", imagePublicId: "t/p", qrPayload: `${code}-BLU`,
    }).returning();
    const sizes = await db.insert(designSize).values(["S", "M", "L", "XL"].map((label, index) => ({ variantId: variant.id, sizeLabel: label, displayOrder: index, includedInSet: true }))).returning();
    return { design: designRow, variant, sizes };
}

const challan = (overrides = {}) => ({
    jobberName: "Ramesh Garments", challanNo: "DC-1", issuedChallanNo: "SF/ISS/1", stockDate: "2026-09-01", defectAction: "seconds", ...overrides,
});

function payload(fixture, extra = {}, challanOverrides = {}) {
    return {
        challan: challan(challanOverrides),
        designs: [{
            designId: fixture.design.id,
            variants: [{
                colorVariantId: fixture.variant.id, totalSetsReceived: 3,
                bundles: [{ quantity: 1, composition: [{ designSizeId: fixture.sizes[0].id, quantity: 1 }, { designSizeId: fixture.sizes[1].id, quantity: 1 }] }],
                loosePieces: [{ designSizeId: fixture.sizes[2].id, quantity: 2 }],
                defectivePieces: 1, defectCategory: "Oil stain on collar",
                tagging: { strategy: "parentChild", childTagsEnabled: false, tagLoosePieces: true },
                ...extra,
            }],
        }],
    };
}

const totalInventory = async (variantId) =>
    (await db.select().from(variantInventory).where(eq(variantInventory.colorVariantId, variantId))).reduce((sum, row) => sum + row.quantity, 0);

describe("stock-in challans", () => {
    it("issues running serials and reports the challan's counts", async () => {
        const fixture = await seedDesign("CH100");
        const first = await stockInService.registerStockIn(payload(fixture));
        const second = await stockInService.registerStockIn(payload(fixture, {}, { challanNo: "DC-2" }));

        expect(first.challan.serialLabel).toBe("SF-0001");
        expect(second.challan.serialLabel).toBe("SF-0002");

        const list = await stockInChallanService.list({ status: "active", sort: "new", page: 1, limit: 8 });
        const row = list.items.find((item) => item.challanNo === "DC-1");
        // 3 sets x 4 sizes + 1 semi set of 2 + 2 loose = 16
        expect(row).toMatchObject({ sets: 3, semiSets: 1, loosePieces: 2, totalPieces: 16, defective: 1, jobberName: "Ramesh Garments" });
        expect(list.serials.next).toBe("SF-0003");
    });

    it("rejects the same challan number twice for one jobber", async () => {
        const fixture = await seedDesign("CH101");
        await stockInService.registerStockIn(payload(fixture));
        await expect(stockInService.registerStockIn(payload(fixture))).rejects.toMatchObject({ code: "DUPLICATE_CHALLAN" });
    });

    it("edits details with a diff, and keeps the transactions in step", async () => {
        const fixture = await seedDesign("CH102");
        const { challan: made } = await stockInService.registerStockIn(payload(fixture));
        const updated = await stockInChallanService.update(made.id, {
            jobberName: "Ramesh Garments", challanNo: "DC-9", issuedChallanNo: "SF/ISS/1", stockDate: "2026-09-01", reason: "typo",
        });
        expect(updated.challanNo).toBe("DC-9");
        expect(updated.events.at(-1)).toMatchObject({ kind: "EDIT", note: "typo", changes: [{ field: "Jobber challan no.", from: "DC-1", to: "DC-9" }] });
        await expect(stockInChallanService.update(made.id, { jobberName: "Ramesh Garments", challanNo: "DC-9", issuedChallanNo: "SF/ISS/1", stockDate: "2026-09-01", reason: "x" }))
            .rejects.toMatchObject({ code: "NO_CHANGES" });
    });

    it("drops a challan: stock removed, serial kept, never reused", async () => {
        const fixture = await seedDesign("CH103");
        const { challan: made } = await stockInService.registerStockIn(payload(fixture));
        expect(await totalInventory(fixture.variant.id)).toBe(16);

        const dropped = await stockInChallanService.drop(made.id, { reason: "entered twice" });
        expect(dropped.status).toBe("DROPPED");
        expect(await totalInventory(fixture.variant.id)).toBe(0);
        expect((await db.select().from(stockItem)).every((item) => item.status === "CONSUMED")).toBe(true);

        const next = await stockInService.registerStockIn(payload(fixture, {}, { challanNo: "DC-3" }));
        expect(next.challan.serialLabel).toBe("SF-0002");
        const list = await stockInChallanService.list({ status: "dropped", sort: "new", page: 1, limit: 8 });
        expect(list.items.map((item) => item.serialLabel)).toEqual(["SF-0001"]);
        expect(list.serials.dropped).toEqual(["SF-0001"]);
    });

    it("refuses to drop once pieces have been sold", async () => {
        const fixture = await seedDesign("CH104");
        const { challan: made } = await stockInService.registerStockIn(payload(fixture));
        const [item] = await db.select().from(stockItem).limit(1);
        await db.update(stockItem).set({ status: "CONSUMED" }).where(eq(stockItem.id, item.id));
        await expect(stockInChallanService.drop(made.id, { reason: "oops" })).rejects.toMatchObject({ code: "CHALLAN_STOCK_MOVED" });
    });

    it("returns the per-variant breakdown for the detail view", async () => {
        const fixture = await seedDesign("CH105");
        const { challan: made } = await stockInService.registerStockIn(payload(fixture));
        const detail = await stockInChallanService.getById(made.id);
        expect(detail.lines).toHaveLength(1);
        expect(detail.lines[0]).toMatchObject({ designCode: "CH105", sets: 3, semiSetCount: 1, loosePieces: 2, pieces: 16, defective: 1, defectCategory: "Oil stain on collar" });
        expect(detail.lines[0].semiSets[0].sizes).toEqual(["S", "M"]);
        expect(detail.lines[0].loose).toEqual({ L: 2 });
    });
});
