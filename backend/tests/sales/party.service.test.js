import { afterAll, beforeEach, describe, expect, it } from "vitest";
import partyService from "../../src/modules/sales/services/party.service.js";
import { disconnect, truncate } from "../helpers/db.js";

beforeEach(() => truncate(["parties"]));
afterAll(() => disconnect());

const MEERA = {
    name: "Meera Textiles",
    mobile: "98250 11210",
    city: "Surat",
    gst: "24AAECM1234F1Z5",
    transport: "Shree Balaji Roadways",
    agent: "Ramesh Bhai",
};

describe("partyService.createParty", () => {
    it("returns the created party in API shape", async () => {
        const created = await partyService.createParty(MEERA);

        expect(created).toMatchObject({ name: "Meera Textiles", city: "Surat", isActive: true });
        expect(created.id).toBeTypeOf("number");
        expect(created).not.toHaveProperty("normalizedName");
    });

    it("stores an omitted optional field as null rather than an empty string", async () => {
        const created = await partyService.createParty({ name: "Walk-in Customer", gst: "" });

        expect(created.gst).toBe("");
    });

    it("rejects an exact duplicate name with 409 PARTY_NAME_EXISTS", async () => {
        await partyService.createParty(MEERA);

        await expect(partyService.createParty(MEERA)).rejects.toMatchObject({ statusCode: 409, code: "PARTY_NAME_EXISTS" });
    });

    it("rejects a duplicate differing only in case, naming the party that already exists", async () => {
        await partyService.createParty(MEERA);

        await expect(partyService.createParty({ name: "MEERA TEXTILES" }))
            .rejects.toMatchObject({ code: "PARTY_NAME_EXISTS", message: "Meera Textiles already exists in Party Master." });
    });

    it("rejects a duplicate differing only in surrounding whitespace", async () => {
        await partyService.createParty(MEERA);

        await expect(partyService.createParty({ name: "  Meera Textiles  " }))
            .rejects.toMatchObject({ code: "PARTY_NAME_EXISTS" });
    });
});

describe("partyService.updateParty", () => {
    it("applies a patch", async () => {
        const created = await partyService.createParty(MEERA);

        const updated = await partyService.updateParty(created.id, { ...MEERA, transport: "Gujarat Cargo Movers" });

        expect(updated.transport).toBe("Gujarat Cargo Movers");
    });

    it("lets a party keep its own name", async () => {
        const created = await partyService.createParty(MEERA);

        const updated = await partyService.updateParty(created.id, { ...MEERA, city: "Navsari" });

        expect(updated.city).toBe("Navsari");
        expect(updated.name).toBe("Meera Textiles");
    });

    it("rejects renaming onto another party's name", async () => {
        const created = await partyService.createParty(MEERA);
        await partyService.createParty({ name: "Rani Wholesale" });

        await expect(partyService.updateParty(created.id, { name: "Rani Wholesale" }))
            .rejects.toMatchObject({ statusCode: 409, code: "PARTY_NAME_EXISTS" });
    });

    it("404s on an unknown id", async () => {
        await expect(partyService.updateParty(999999, { name: "Nobody" }))
            .rejects.toMatchObject({ statusCode: 404, code: "PARTY_NOT_FOUND" });
    });
});

describe("partyService.setStatus", () => {
    it("soft deletes and restores", async () => {
        const created = await partyService.createParty(MEERA);

        const deactivated = await partyService.setStatus(created.id, false);
        expect(deactivated.isActive).toBe(false);

        const restored = await partyService.setStatus(created.id, true);
        expect(restored.isActive).toBe(true);
    });

    it("hides inactive parties from the default listing but keeps them findable", async () => {
        const created = await partyService.createParty(MEERA);
        await partyService.setStatus(created.id, false);

        const active = await partyService.listParties({ page: 1, limit: 10 });
        const all = await partyService.listParties({ page: 1, limit: 10, includeInactive: true });

        expect(active.data).toHaveLength(0);
        expect(all.data).toHaveLength(1);
    });

    it("404s on an unknown id", async () => {
        await expect(partyService.setStatus(999999, false))
            .rejects.toMatchObject({ statusCode: 404, code: "PARTY_NOT_FOUND" });
    });
});

describe("partyService.listParties", () => {
    it("paginates and reports totals in meta", async () => {
        await partyService.createParty({ name: "Anjali Collections" });
        await partyService.createParty({ name: "Meera Textiles" });
        await partyService.createParty({ name: "Rani Wholesale" });

        const page = await partyService.listParties({ page: 1, limit: 2 });

        expect(page.data.map((p) => p.name)).toEqual(["Anjali Collections", "Meera Textiles"]);
        expect(page.meta).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
    });

    it("filters by keyword", async () => {
        await partyService.createParty(MEERA);
        await partyService.createParty({ name: "Rani Wholesale", city: "Rajkot" });

        const found = await partyService.listParties({ page: 1, limit: 10, q: "rajkot" });

        expect(found.data.map((p) => p.name)).toEqual(["Rani Wholesale"]);
    });
});

describe("partyService.getParty", () => {
    it("returns one party", async () => {
        const created = await partyService.createParty(MEERA);

        expect((await partyService.getParty(created.id)).name).toBe("Meera Textiles");
    });

    it("404s on an unknown id", async () => {
        await expect(partyService.getParty(999999)).rejects.toMatchObject({ statusCode: 404, code: "PARTY_NOT_FOUND" });
    });
});

describe("partyService.countParties", () => {
    it("counts active parties", async () => {
        await partyService.createParty(MEERA);
        await partyService.createParty({ name: "Rani Wholesale" });

        expect(await partyService.countParties()).toBe(2);
    });
});
