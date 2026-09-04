import { afterAll, beforeEach, describe, expect, it } from "vitest";

import invoiceService from "../../src/modules/sales/services/invoice.service.js";
import orderFormService from "../../src/modules/sales/services/orderForm.service.js";
import partyService from "../../src/modules/sales/services/party.service.js";
import { disconnect, truncate } from "../helpers/db.js";
import { SALES_TABLES, seedSellableStock } from "../helpers/fixtures.js";

const PARTY = { name: "Meera Textiles", mobile: "98250 11210", city: "Surat", gst: "24AAECM1234F1Z5", transport: "Balaji", agent: "Ramesh" };

beforeEach(() => truncate(SALES_TABLES));
afterAll(() => disconnect());

async function seedDocuments() {
    const fixture = await seedSellableStock({ designCode: "TST100" });
    const orderForm = await orderFormService.createOrderForm({
        formNumber: "OF-1001",
        formDate: "2026-09-29",
        party: PARTY,
        partySync: "document",
        items: [{ colorVariantId: fixture.variant.id, quantityPcs: 4 }],
    });
    const invoice = await invoiceService.generateInvoice({
        invoiceNumber: "INV-2026-001",
        invoiceDate: "2026-09-29",
        orderFormId: orderForm.id,
        party: PARTY,
        partySync: "document",
        scans: [{ scanCode: fixture.setCodes[0], method: "QR Gun" }],
    });

    return { fixture, orderForm, invoice };
}

describe("searching documents by what is on them", () => {
    it("finds an order form by a design code or colour on its lines", async () => {
        await seedDocuments();

        for (const q of ["tst100", "test blue"]) {
            const { data } = await orderFormService.listOrderForms({ q });
            expect(data.map((form) => form.formNumber)).toEqual(["OF-1001"]);
        }

        expect((await orderFormService.listOrderForms({ q: "kp999" })).data).toEqual([]);
    });

    it("finds an invoice by a design code or colour on its scanned lines", async () => {
        await seedDocuments();

        for (const q of ["tst100", "test blue"]) {
            const { data } = await invoiceService.listInvoices({ q });
            expect(data.map((entry) => entry.invoiceNumber)).toEqual(["INV-2026-001"]);
        }

        expect((await invoiceService.listInvoices({ q: "kp999" })).data).toEqual([]);
    });
});

describe("Party Master list", () => {
    it("reports how many order forms each party has", async () => {
        await seedDocuments();

        const { data } = await partyService.listParties({});

        expect(data).toHaveLength(1);
        expect(data[0]).toMatchObject({ name: "Meera Textiles", orderForms: 1 });
    });
});
