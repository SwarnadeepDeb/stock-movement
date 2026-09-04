import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";

import stockInService from "../../src/modules/stock/services/stockIn.service.js";
import qrBatchService from "../../src/modules/stock/services/qrBatch.service.js";
import { design } from "../../src/modules/design/schemas/design.schema.js";
import { colorVariant } from "../../src/modules/design/schemas/colorVariant.schema.js";
import { designSize } from "../../src/modules/design/schemas/designSize.schema.js";
import { stockItem } from "../../src/modules/stock/schemas/stockItems.schema.js";
import { buildTestApp } from "../helpers/app.js";
import { db, disconnect, truncate } from "../helpers/db.js";

beforeEach(() => truncate(["stock_in_challans", "designs", "print_jobs"]));
afterAll(() => disconnect());

async function seedDesign(code, colours = ["Midnight Blue"]) {
    const [designRow] = await db.insert(design).values({ name: `${code} design`, code, normalizedCode: code.toLowerCase(), defaultSellingPricePerPiece: 300 }).returning();
    const variants = [];
    for (const colorName of colours) {
        const [variant] = await db.insert(colorVariant).values({
            designId: designRow.id, colorName, colorHex: "#1E293B", normalizedColorName: colorName.toLowerCase(),
            imageUrl: "https://example.test/p.jpg", imagePublicId: `t/${colorName}`, qrPayload: `${code}-${colorName}`,
        }).returning();
        const sizes = await db.insert(designSize).values(["S", "M", "L", "XL"].map((label, index) => ({ variantId: variant.id, sizeLabel: label, displayOrder: index, includedInSet: true }))).returning();
        variants.push({ variant, sizes });
    }
    return { design: designRow, variants };
}

let challanCounter = 0;
// Sets-only tagging by default: the sets and the semi set get codes at inward, their pieces and the
// loose pool do not — the state QR Center's batch studio exists to finish.
const inward = (fixture, { tagging, colours = [0], challanNo = `DC-${++challanCounter}` } = {}) => stockInService.registerStockIn({
    challan: { jobberName: "Ganni Bhai", challanNo, issuedChallanNo: "ISS", stockDate: "2026-10-04", defectAction: "seconds" },
    designs: [{
        designId: fixture.design.id,
        variants: colours.map((index) => {
            const { variant, sizes } = fixture.variants[index];
            return {
                colorVariantId: variant.id,
                totalSetsReceived: 2,
                bundles: [{ quantity: 1, composition: [{ designSizeId: sizes[1].id, quantity: 1 }, { designSizeId: sizes[2].id, quantity: 1 }] }],
                loosePieces: [{ designSizeId: sizes[0].id, quantity: 2 }],
                tagging: tagging ?? { strategy: "parent", childTagsEnabled: false, tagLoosePieces: false },
            };
        }),
    }],
});

const listAll = (extra = {}) => qrBatchService.listBatches({ page: 1, limit: 50, status: "all", sort: "new", ...extra });
const kindCounts = (variant) => ({
    parent: variant.tags.filter((tag) => tag.kind === "parent").length,
    child: variant.tags.filter((tag) => tag.kind === "child").length,
    loose: variant.tags.filter((tag) => tag.kind === "loose").length,
});

describe("QR Center stock-in batches", () => {
    it("lists one row per challan with only the tags that already have codes", async () => {
        const fixture = await seedDesign("KP100", ["Midnight Blue", "Crimson Red"]);
        await inward(fixture, { colours: [0, 1], challanNo: "123" });
        await inward(fixture, { challanNo: "456" });

        const { data, meta } = await listAll();
        expect(meta.total).toBe(2);
        expect(meta.counts).toMatchObject({ all: 2, pending: 2, partial: 0, done: 0 });

        const batch = data.find((row) => row.challanNo === "123");
        expect(batch.batchId).toMatch(/^c\d+$/);
        expect(batch.serialLabel).toMatch(/^SF-/);
        expect(batch.variants).toHaveLength(2);
        expect(batch.setCount).toBe(4);
        // two colours x (2 sets + 1 semi set) carry codes; their pieces and the loose pool do not yet
        expect(batch.tagCount).toBe(6);
        expect(batch.printedCount).toBe(0);
        // per colour: 2 sets x 4 pieces + 2 semi pieces + 2 loose = 12 tags still to be created
        expect(batch.notTaggedCount).toBe(24);
        expect(batch.printStatus).toBe("pending");
    });

    it("searches, filters by colour and sorts", async () => {
        const fixture = await seedDesign("KP100", ["Midnight Blue", "Crimson Red"]);
        await inward(fixture, { challanNo: "AAA-1" });
        await inward(fixture, { colours: [1], challanNo: "BBB-2" });

        expect((await listAll({ keyword: "bbb" })).data.map((row) => row.challanNo)).toEqual(["BBB-2"]);
        expect((await listAll({ keyword: "ganni" })).meta.total).toBe(2);
        expect((await listAll({ colorVariantId: fixture.variants[1].variant.id })).data.map((row) => row.challanNo)).toEqual(["BBB-2"]);
        expect((await listAll({ sort: "old" })).data.map((row) => row.challanNo)).toEqual(["AAA-1", "BBB-2"]);
        expect((await listAll({ status: "done" })).meta.total).toBe(0);
    });

    it("shows what a batch can still be tagged with, in print order", async () => {
        const fixture = await seedDesign("KP100");
        await inward(fixture);
        const { data } = await listAll();

        const { variants } = await qrBatchService.getBatch(data[0].batchId);
        const [variant] = variants;
        expect(kindCounts(variant)).toEqual({ parent: 3, child: 10, loose: 2 });
        expect(variant.variant.code).toBe("KP100-MID");
        expect(variant.tags.filter((tag) => tag.code)).toHaveLength(3);
        expect(variant.tags[0]).toMatchObject({ kind: "parent", displayCode: "SET-KP100-MID-001", printed: false });
        // a set is followed by its own pieces
        expect(variant.tags[1]).toMatchObject({ kind: "child", code: null, size: "S", parentDisplayCode: "SET-KP100-MID-001" });
        // the semi set only holds the two sizes it was made of
        const semi = variant.tags.find((tag) => tag.semi);
        expect(semi).toMatchObject({ type: "BUNDLE", composition: ["M", "L"], piecesPerSet: 2 });
    });

    it("issues missing codes on first print, numbering pieces after the colour's last serial", async () => {
        const fixture = await seedDesign("KP100");
        await inward(fixture);
        const { data } = await listAll();
        const batchId = data[0].batchId;

        const result = await qrBatchService.issueBatch(batchId, { parentChild: true, loose: true, reprint: false });
        expect(result.printItems).toHaveLength(15);
        expect(result.printItems.every((item) => item.shortCode)).toBe(true);
        expect(new Set(result.printItems.map((item) => item.shortCode)).size).toBe(15);
        // nothing is marked printed until the print is confirmed
        expect(result.batch).toMatchObject({ tagCount: 15, printedCount: 0, notTaggedCount: 0 });

        const variantId = fixture.variants[0].variant.id;
        const items = await db.select().from(stockItem).where(eq(stockItem.colorVariantId, variantId)).orderBy(asc(stockItem.id));
        expect(items.filter((item) => item.type === "LOOSE_PIECE")).toHaveLength(0);
        const pieces = items.filter((item) => item.type === "PIECE");
        expect(pieces.map((item) => item.serialNo).sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
        // pieces sit inside their set; the two loose ones belong to none
        expect(pieces.filter((item) => item.parentStockItemId)).toHaveLength(10);
        expect(pieces.filter((item) => !item.originSetStockItemId)).toHaveLength(2);
        expect(await stockInService.getSerialCounters([variantId])).toEqual([{ colorVariantId: variantId, lastSetSerial: 3, lastPieceSerial: 12 }]);

        // asking again must not create the same pieces twice
        await qrBatchService.issueBatch(batchId, { parentChild: true, loose: true, reprint: true });
        expect((await db.select().from(stockItem).where(eq(stockItem.colorVariantId, variantId))).filter((item) => item.type === "PIECE")).toHaveLength(12);
    });

    it("only creates the tag types the strategy asks for", async () => {
        const fixture = await seedDesign("KP100");
        await inward(fixture);
        const [{ batchId }] = (await listAll()).data;

        const sets = await qrBatchService.issueBatch(batchId, { parentChild: true, loose: false, reprint: false });
        expect(sets.printItems.filter((item) => item.kind === "loose")).toHaveLength(0);
        expect(sets.printItems).toHaveLength(13);

        const looseOnly = await qrBatchService.issueBatch(batchId, { parentChild: false, loose: true, reprint: false });
        expect(looseOnly.printItems.map((item) => item.kind)).toEqual(["loose", "loose"]);
    });

    it("moves a batch to partial, then done, as prints are confirmed", async () => {
        const fixture = await seedDesign("KP100");
        await inward(fixture);
        const [{ batchId }] = (await listAll()).data;

        const sets = await qrBatchService.issueBatch(batchId, { parentChild: true, loose: false, reprint: false });
        const parentQrIds = sets.printItems.filter((item) => item.kind === "parent").map((item) => item.qrId);
        const first = await qrBatchService.confirmPrint(batchId, { stockItemQrIds: parentQrIds });
        expect(first.printedCount).toBe(3);
        expect(first.batch).toMatchObject({ printedCount: 3, tagCount: 13, printStatus: "partial" });
        expect((await listAll()).meta.counts).toMatchObject({ partial: 1, pending: 0 });

        // the rest still queues, the printed parents do not
        const rest = await qrBatchService.issueBatch(batchId, { parentChild: true, loose: true, reprint: false });
        expect(rest.printItems.some((item) => item.kind === "parent")).toBe(false);
        const done = await qrBatchService.confirmPrint(batchId, { stockItemQrIds: rest.printItems.map((item) => item.qrId) });
        expect(done.batch).toMatchObject({ tagCount: 15, printedCount: 15, printStatus: "done" });

        await expect(qrBatchService.issueBatch(batchId, { parentChild: true, loose: true, reprint: false })).rejects.toMatchObject({ code: "NOTHING_TO_PRINT" });
        const again = await qrBatchService.issueBatch(batchId, { parentChild: true, loose: true, reprint: true });
        expect(again.printItems).toHaveLength(15);
    });

    it("leaves colours switched off in the studio alone", async () => {
        const fixture = await seedDesign("KP100", ["Midnight Blue", "Crimson Red"]);
        await inward(fixture, { colours: [0, 1] });
        const [{ batchId, variants }] = (await listAll()).data;

        const result = await qrBatchService.issueBatch(batchId, { parentChild: true, loose: true, reprint: false, transactionIds: [variants[0].transactionId] });
        expect(new Set(result.printItems.map((item) => item.variant.id))).toEqual(new Set([fixture.variants[0].variant.id]));
        // the other colour keeps its pieces untagged
        expect(result.variants[1].tags.filter((tag) => tag.code)).toHaveLength(3);
        expect(result.variants[0].tags.filter((tag) => tag.code)).toHaveLength(15);
    });

    it("lists tags already created at inward as issued, with nothing left to generate", async () => {
        const fixture = await seedDesign("KP100");
        await inward(fixture, { tagging: { strategy: "parentChild", childTagsEnabled: false, tagLoosePieces: true } });
        const { data } = await listAll();

        expect(data[0]).toMatchObject({ tagCount: 15, notTaggedCount: 0, printStatus: "pending" });
        const { variants } = await qrBatchService.getBatch(data[0].batchId);
        expect(kindCounts(variants[0])).toEqual({ parent: 3, child: 10, loose: 2 });
        expect(variants[0].tags.every((tag) => tag.code)).toBe(true);
    });

    it("rejects tags from another batch and unknown batches", async () => {
        const fixture = await seedDesign("KP100");
        await inward(fixture, { challanNo: "ONE" });
        await inward(fixture, { challanNo: "TWO" });
        const [two, one] = (await listAll()).data;
        const issued = await qrBatchService.issueBatch(one.batchId, { parentChild: true, loose: false, reprint: false });

        await expect(qrBatchService.confirmPrint(two.batchId, { stockItemQrIds: [issued.printItems[0].qrId] })).rejects.toMatchObject({ code: "TAG_NOT_IN_BATCH" });
        await expect(qrBatchService.getBatch("c999999")).rejects.toMatchObject({ code: "BATCH_NOT_FOUND" });
        await expect(qrBatchService.getBatch("nope")).rejects.toMatchObject({ code: "INVALID_BATCH_ID" });
        await expect(qrBatchService.issueBatch(one.batchId, { parentChild: false, loose: false, reprint: false })).rejects.toMatchObject({ code: "NO_TAG_TYPE_SELECTED" });
    });
});

describe("QR Center batch routes", () => {
    const app = buildTestApp();
    const codeOf = (body) => body.error?.code ?? body.code;

    it("serves the list, detail, issue and confirm-print flow over HTTP", async () => {
        const fixture = await seedDesign("KP100");
        await inward(fixture, { challanNo: "HTTP-1" });

        const list = await request(app).get("/api/v1/qr-center/batches?status=pending&sort=tags&limit=10");
        expect(list.status).toBe(200);
        expect(list.body.data).toHaveLength(1);
        expect(list.body.meta.counts).toMatchObject({ all: 1, pending: 1 });
        const { batchId } = list.body.data[0];

        const detail = await request(app).get(`/api/v1/qr-center/batches/${batchId}`);
        expect(detail.status).toBe(200);
        expect(detail.body.data.batch).toMatchObject({ challanNo: "HTTP-1", printStatus: "pending" });
        expect(detail.body.data.variants[0].tags).toHaveLength(15);

        const issued = await request(app).post(`/api/v1/qr-center/batches/${batchId}/issue`).send({ parentChild: true, loose: true });
        expect(issued.status).toBe(200);
        expect(issued.body.data.printItems).toHaveLength(15);

        const confirmed = await request(app).post(`/api/v1/qr-center/batches/${batchId}/confirm-print`).send({ stockItemQrIds: issued.body.data.printItems.map((item) => item.qrId) });
        expect(confirmed.status).toBe(200);
        expect(confirmed.body.data.batch.printStatus).toBe("done");

        const done = await request(app).get("/api/v1/qr-center/batches?status=done");
        expect(done.body.data.map((row) => row.batchId)).toEqual([batchId]);
    });

    it("rejects malformed requests before they reach the service", async () => {
        const badId = await request(app).get("/api/v1/qr-center/batches/not-a-batch");
        expect(badId.status).toBe(400);
        expect(codeOf(badId.body)).toBe("VALIDATION_ERROR");

        const badStatus = await request(app).get("/api/v1/qr-center/batches?status=weird");
        expect(badStatus.status).toBe(400);

        const noTags = await request(app).post("/api/v1/qr-center/batches/c1/confirm-print").send({ stockItemQrIds: [] });
        expect(noTags.status).toBe(400);

        const missing = await request(app).get("/api/v1/qr-center/batches/c424242");
        expect(missing.status).toBe(404);
        expect(codeOf(missing.body)).toBe("BATCH_NOT_FOUND");
    });
});
