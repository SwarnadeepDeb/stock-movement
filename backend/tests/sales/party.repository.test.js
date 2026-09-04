import { afterAll, beforeEach, describe, expect, it } from "vitest";
import partyRepository from "../../src/modules/sales/repositories/party.repository.js";
import { db, disconnect, truncate } from "../helpers/db.js";

beforeEach(() => truncate(["parties"]));
afterAll(() => disconnect());

describe("partyRepository", () => {
    it("stores a trimmed, lowercased normalized name alongside the name as typed", async () => {
        const created = await partyRepository.create(db, { name: "  Meera Textiles  ", city: "Surat" });

        expect(created.name).toBe("Meera Textiles");
        expect(created.normalizedName).toBe("meera textiles");
    });

    it("finds a party by name regardless of case or surrounding whitespace", async () => {
        await partyRepository.create(db, { name: "Meera Textiles" });

        const found = await partyRepository.findByName(db, "  MEERA TEXTILES ");

        expect(found?.name).toBe("Meera Textiles");
    });

    it("excludes a given id from the name lookup, so a party can keep its own name on update", async () => {
        const created = await partyRepository.create(db, { name: "Meera Textiles" });

        const found = await partyRepository.findByName(db, "Meera Textiles", created.id);

        expect(found).toBeUndefined();
    });

    it("searches name, mobile, city and gst", async () => {
        await partyRepository.create(db, { name: "Meera Textiles", mobile: "98250 11210", city: "Surat", gst: "24AAECM1234F1Z5" });
        await partyRepository.create(db, { name: "Rani Wholesale", mobile: "96011 47110", city: "Rajkot", gst: "24AAPCR5678H1Z2" });

        const byCity = await partyRepository.findMany(db, { limit: 10, offset: 0, keyword: "rajkot" });
        const byGst = await partyRepository.findMany(db, { limit: 10, offset: 0, keyword: "AAECM" });
        const byMobile = await partyRepository.findMany(db, { limit: 10, offset: 0, keyword: "96011" });

        expect(byCity.map((p) => p.name)).toEqual(["Rani Wholesale"]);
        expect(byGst.map((p) => p.name)).toEqual(["Meera Textiles"]);
        expect(byMobile.map((p) => p.name)).toEqual(["Rani Wholesale"]);
    });

    it("counts only rows matching the filter", async () => {
        await partyRepository.create(db, { name: "Meera Textiles", city: "Surat" });
        await partyRepository.create(db, { name: "Rani Wholesale", city: "Rajkot" });

        expect(await partyRepository.count(db, { keyword: "surat" })).toBe(1);
        expect(await partyRepository.count(db, {})).toBe(2);
    });

    it("updates a name and its normalized form together", async () => {
        const created = await partyRepository.create(db, { name: "Meera Textiles" });

        const updated = await partyRepository.update(db, created.id, { name: "Meera Textiles Pvt Ltd" });

        expect(updated.normalizedName).toBe("meera textiles pvt ltd");
    });

    it("hides inactive parties unless asked for them", async () => {
        const created = await partyRepository.create(db, { name: "Meera Textiles" });
        await partyRepository.setActive(db, created.id, false);

        const active = await partyRepository.findMany(db, { limit: 10, offset: 0 });
        const all = await partyRepository.findMany(db, { limit: 10, offset: 0, includeInactive: true });

        expect(active).toHaveLength(0);
        expect(all).toHaveLength(1);
    });
});
