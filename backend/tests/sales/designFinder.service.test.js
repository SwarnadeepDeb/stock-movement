import { afterAll, beforeEach, describe, expect, it } from "vitest";

import designFinderService from "../../src/modules/sales/services/designFinder.service.js";
import { disconnect, truncate } from "../helpers/db.js";
import { SALES_TABLES, seedSellableStock } from "../helpers/fixtures.js";

beforeEach(() => truncate(SALES_TABLES));
afterAll(() => disconnect());

describe("design finder", () => {
    it("finds a design by its code and reports each colour's live stock and set size", async () => {
        const fixture = await seedSellableStock({ designCode: "TST100", sets: 2, loose: 1 });

        const [result] = await designFinderService.search("tst1");

        expect(result.designCode).toBe("TST100");
        expect(result.unitPrice).toBe(fixture.price);
        expect(result.setSizes).toEqual(["S", "M", "L", "XL"]);
        expect(result.variants).toHaveLength(1);
        expect(result.variants[0]).toMatchObject({ colorVariantId: fixture.variant.id, setPieces: 4 });
        // Two sets of four sizes plus one loose piece.
        expect(result.variants[0].availablePcs).toBe(9);
        expect(result.totalAvailablePcs).toBe(9);
    });

    it("matches a colour name typed alongside the code and highlights that colour", async () => {
        const fixture = await seedSellableStock({ designCode: "TST100" });

        const [byColour] = await designFinderService.search("tst100 blue");
        expect(byColour.designCode).toBe("TST100");
        expect(byColour.focusColorVariantId).toBe(fixture.variant.id);

        const [colourOnly] = await designFinderService.search("test blue");
        expect(colourOnly.designCode).toBe("TST100");
    });

    it("resolves a hanging tag to its design and colour", async () => {
        const fixture = await seedSellableStock({ designCode: "TST100" });

        const [result] = await designFinderService.search(fixture.setCodes[0]);

        expect(result.designCode).toBe("TST100");
        expect(result.focusColorVariantId).toBe(fixture.variant.id);
    });

    it("resolves a design code plus the first letters of a colour", async () => {
        const fixture = await seedSellableStock({ designCode: "TST100" });

        const [result] = await designFinderService.search("TST100-TES");

        expect(result.designCode).toBe("TST100");
        expect(result.focusColorVariantId).toBe(fixture.variant.id);
    });

    it("returns nothing for text that names no design, and the first designs for an empty search", async () => {
        await seedSellableStock({ designCode: "TST100" });

        expect(await designFinderService.search("zzzzzz")).toEqual([]);

        const quick = await designFinderService.search("");
        expect(quick.map((entry) => entry.designCode)).toEqual(["TST100"]);
    });

    it("needs every typed word to match", async () => {
        await seedSellableStock({ designCode: "TST100" });

        expect(await designFinderService.search("tst100 crimson")).toEqual([]);
    });

    it("loads one design with its colours for a scanned tag", async () => {
        const fixture = await seedSellableStock({ designCode: "TST100" });

        const design = await designFinderService.byId(fixture.design.id, { focusColorVariantId: fixture.variant.id });

        expect(design.designCode).toBe("TST100");
        expect(design.focusColorVariantId).toBe(fixture.variant.id);
        expect(design.variants).toHaveLength(1);
    });
});
