import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { disconnect, truncate } from "../helpers/db.js";

const app = buildTestApp();

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

const codeOf = (body) => body.error?.code ?? body.code;

async function createMeera() {
    const response = await request(app).post("/api/v1/parties").send(MEERA);
    return response.body.data;
}

describe("POST /api/v1/parties", () => {
    it("creates a party", async () => {
        const response = await request(app).post("/api/v1/parties").send(MEERA);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({ name: "Meera Textiles", city: "Surat" });
    });

    it("400s with VALIDATION_ERROR when the name is missing", async () => {
        const response = await request(app).post("/api/v1/parties").send({ city: "Surat" });

        expect(response.status).toBe(400);
        expect(codeOf(response.body)).toBe("VALIDATION_ERROR");
    });

    it("409s with PARTY_NAME_EXISTS on a duplicate", async () => {
        await createMeera();

        const response = await request(app).post("/api/v1/parties").send(MEERA);

        expect(response.status).toBe(409);
        expect(codeOf(response.body)).toBe("PARTY_NAME_EXISTS");
    });
});

describe("GET /api/v1/parties", () => {
    it("lists parties with meta", async () => {
        await createMeera();

        const response = await request(app).get("/api/v1/parties");

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.meta).toMatchObject({ page: 1, total: 1 });
    });

    it("filters by q", async () => {
        await createMeera();
        await request(app).post("/api/v1/parties").send({ name: "Rani Wholesale", city: "Rajkot" });

        const response = await request(app).get("/api/v1/parties?q=rajkot");

        expect(response.body.data.map((p) => p.name)).toEqual(["Rani Wholesale"]);
    });
});

describe("GET /api/v1/parties/summary", () => {
    it("returns the party count and is not parsed as an id", async () => {
        await createMeera();

        const response = await request(app).get("/api/v1/parties/summary");

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual({ partyCount: 1 });
    });
});

describe("GET /api/v1/parties/:id", () => {
    it("returns one party", async () => {
        const created = await createMeera();

        const response = await request(app).get(`/api/v1/parties/${created.id}`);

        expect(response.status).toBe(200);
        expect(response.body.data.name).toBe("Meera Textiles");
    });

    it("404s with PARTY_NOT_FOUND", async () => {
        const response = await request(app).get("/api/v1/parties/999999");

        expect(response.status).toBe(404);
        expect(codeOf(response.body)).toBe("PARTY_NOT_FOUND");
    });
});

describe("PUT /api/v1/parties/:id", () => {
    it("updates a party", async () => {
        const created = await createMeera();

        const response = await request(app).put(`/api/v1/parties/${created.id}`)
            .send({ ...MEERA, transport: "Gujarat Cargo Movers" });

        expect(response.status).toBe(200);
        expect(response.body.data.transport).toBe("Gujarat Cargo Movers");
    });

    it("409s when renaming onto another party", async () => {
        const created = await createMeera();
        await request(app).post("/api/v1/parties").send({ name: "Rani Wholesale" });

        const response = await request(app).put(`/api/v1/parties/${created.id}`).send({ name: "Rani Wholesale" });

        expect(response.status).toBe(409);
        expect(codeOf(response.body)).toBe("PARTY_NAME_EXISTS");
    });
});

describe("PATCH /api/v1/parties/:id/status", () => {
    it("soft deletes a party", async () => {
        const created = await createMeera();

        const response = await request(app).patch(`/api/v1/parties/${created.id}/status`).send({ isActive: false });

        expect(response.status).toBe(200);
        expect(response.body.data.isActive).toBe(false);
    });
});
