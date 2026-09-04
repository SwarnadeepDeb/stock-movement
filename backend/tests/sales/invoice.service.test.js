import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

import invoiceService from "../../src/modules/sales/services/invoice.service.js";
import orderFormService from "../../src/modules/sales/services/orderForm.service.js";
import { stockItem } from "../../src/modules/stock/schemas/stockItems.schema.js";
import { variantInventory } from "../../src/modules/inventory/schemas/variantInventory.schema.js";
import { stockHistory } from "../../src/modules/stock/schemas/stockHistory.schema.js";
import { db, disconnect, truncate } from "../helpers/db.js";
import { SALES_TABLES, seedSellableStock } from "../helpers/fixtures.js";

const PARTY = { name: "Meera Textiles", mobile: "98250 11210", city: "Surat", gst: "24AAECM1234F1Z5", transport: "Balaji", agent: "Ramesh" };

beforeEach(() => truncate(SALES_TABLES));
afterAll(() => disconnect());

async function seedOrderForm(fixture, quantityPcs = 8) {
    return orderFormService.createOrderForm({
        formNumber: "OF-1001",
        formDate: "2026-09-29",
        party: PARTY,
        partySync: "document",
        items: [{ colorVariantId: fixture.variant.id, quantityPcs }],
    });
}

function invoicePayload(orderForm, codes, overrides = {}) {
    return {
        invoiceNumber: "INV-2026-001",
        invoiceDate: "2026-09-29",
        orderFormId: orderForm.id,
        party: PARTY,
        partySync: "document",
        scans: codes.map((scanCode) => ({ scanCode, method: "QR Gun" })),
        ...overrides,
    };
}

async function statusOf(stockItemId) {
    const [row] = await db.select().from(stockItem).where(eq(stockItem.id, stockItemId));
    return row.status;
}

async function inventoryFor(variantId, designSizeId) {
    const [row] = await db.select().from(variantInventory)
        .where(and(eq(variantInventory.colorVariantId, variantId), eq(variantInventory.designSizeId, designSizeId)));
    return row?.quantity ?? 0;
}

describe("generateInvoice", () => {
    it("derives pieces, sizes and amount from the scanned tags rather than from a quantity", async () => {
        const fixture = await seedSellableStock();
        const orderForm = await seedOrderForm(fixture);

        const invoice = await invoiceService.generateInvoice(
            invoicePayload(orderForm, [fixture.setCodes[0], fixture.looseCodes[0]]),
        );

        // One set of four sizes, plus one loose piece.
        expect(invoice.totalPcs).toBe(5);
        expect(invoice.totalAmount).toBe(5 * fixture.price);
        expect(invoice.lines).toHaveLength(1);
        expect(invoice.lines[0].packedAs).toBe("1 set + 1 pc");
        expect(invoice.lines[0].sizes).toEqual({ S: 2, M: 1, L: 1, XL: 1 });
    });

    it("consumes the scanned stock items", async () => {
        const fixture = await seedSellableStock();
        const orderForm = await seedOrderForm(fixture);

        await invoiceService.generateInvoice(invoicePayload(orderForm, [fixture.setCodes[0]]));

        expect(await statusOf(fixture.setItems[0].id)).toBe("CONSUMED");
        // The tag that was not scanned is untouched.
        expect(await statusOf(fixture.setItems[1].id)).toBe("AVAILABLE");
    });

    it("decrements inventory once per size in the set", async () => {
        const fixture = await seedSellableStock();
        const orderForm = await seedOrderForm(fixture);
        const before = await inventoryFor(fixture.variant.id, fixture.sizes[1].id);

        await invoiceService.generateInvoice(invoicePayload(orderForm, [fixture.setCodes[0]]));

        expect(await inventoryFor(fixture.variant.id, fixture.sizes[1].id)).toBe(before - 1);
    });

    it("writes a STOCK_OUT history event naming the invoice", async () => {
        const fixture = await seedSellableStock();
        const orderForm = await seedOrderForm(fixture);

        await invoiceService.generateInvoice(invoicePayload(orderForm, [fixture.setCodes[0]]));

        const [event] = await db.select().from(stockHistory).where(eq(stockHistory.eventType, "STOCK_OUT"));
        expect(event.quantity).toBe(4);
        expect(event.metadata.invoiceNumber).toBe("INV-2026-001");
        // The schema forbids inventing a user id when there is no users table.
        expect(event.performedBy).toBeNull();
    });

    it("locks the order form it was built against", async () => {
        const fixture = await seedSellableStock();
        const orderForm = await seedOrderForm(fixture);

        await invoiceService.generateInvoice(invoicePayload(orderForm, [fixture.setCodes[0]]));

        const reloaded = await orderFormService.getOrderForm(orderForm.id);
        expect(reloaded.status).toBe("INVOICED");

        await expect(orderFormService.updateOrderForm(orderForm.id, {
            formNumber: "OF-1001", party: PARTY, partySync: "document",
            items: [{ colorVariantId: fixture.variant.id, quantityPcs: 2 }],
        })).rejects.toMatchObject({ code: "ORDER_FORM_LOCKED" });
    });

    it("refuses to bill a tag that is already consumed", async () => {
        const fixture = await seedSellableStock();
        const orderForm = await seedOrderForm(fixture);
        await invoiceService.generateInvoice(invoicePayload(orderForm, [fixture.setCodes[0]]));

        const second = await orderFormService.createOrderForm({
            formNumber: "OF-1002", party: PARTY, partySync: "document",
            items: [{ colorVariantId: fixture.variant.id, quantityPcs: 4 }],
        });

        await expect(invoiceService.generateInvoice(
            invoicePayload(second, [fixture.setCodes[0]], { invoiceNumber: "INV-2026-002" }),
        )).rejects.toMatchObject({ code: "STOCK_ITEM_UNAVAILABLE" });
    });

    it("refuses an unknown tag and leaves stock untouched", async () => {
        const fixture = await seedSellableStock();
        const orderForm = await seedOrderForm(fixture);

        await expect(invoiceService.generateInvoice(
            invoicePayload(orderForm, [fixture.setCodes[0], "NOSUCHTAG"]),
        )).rejects.toMatchObject({ code: "SCAN_UNRESOLVED" });

        // The whole request is one transaction: the valid tag in the same payload must not have
        // been consumed by the attempt.
        expect(await statusOf(fixture.setItems[0].id)).toBe("AVAILABLE");
    });

    it("rejects the same tag twice in one invoice", async () => {
        const fixture = await seedSellableStock();
        const orderForm = await seedOrderForm(fixture);

        await expect(invoiceService.generateInvoice(
            invoicePayload(orderForm, [fixture.setCodes[0], fixture.setCodes[0]]),
        )).rejects.toMatchObject({ code: "SCAN_DUPLICATED" });
    });

    it("rejects a duplicate invoice number", async () => {
        const fixture = await seedSellableStock();
        const orderForm = await seedOrderForm(fixture);
        await invoiceService.generateInvoice(invoicePayload(orderForm, [fixture.setCodes[0]]));

        const second = await orderFormService.createOrderForm({
            formNumber: "OF-1002", party: PARTY, partySync: "document",
            items: [{ colorVariantId: fixture.variant.id, quantityPcs: 4 }],
        });

        await expect(invoiceService.generateInvoice(
            invoicePayload(second, [fixture.setCodes[1]]),
        )).rejects.toMatchObject({ code: "INVOICE_NUMBER_EXISTS" });
    });

    it("refuses to invoice an order form twice", async () => {
        const fixture = await seedSellableStock();
        const orderForm = await seedOrderForm(fixture);
        await invoiceService.generateInvoice(invoicePayload(orderForm, [fixture.setCodes[0]]));

        await expect(invoiceService.generateInvoice(
            invoicePayload(orderForm, [fixture.setCodes[1]], { invoiceNumber: "INV-2026-002" }),
        )).rejects.toMatchObject({ code: "ORDER_FORM_ALREADY_INVOICED" });
    });

    it("flags a billed variant the order form never asked for as an extra", async () => {
        const fixture = await seedSellableStock();
        const other = await seedSellableStock({ designCode: "TST200" });

        const orderForm = await seedOrderForm(fixture);

        const invoice = await invoiceService.generateInvoice(
            invoicePayload(orderForm, [fixture.setCodes[0], other.setCodes[0]]),
        );

        const extra = invoice.lines.find((line) => line.designCode === "TST200");
        expect(extra.isExtra).toBe(true);
        expect(invoice.lines.find((line) => line.designCode === "TST100").isExtra).toBe(false);
    });
});

describe("updateInvoice", () => {
    it("returns a removed tag to stock and credits inventory back", async () => {
        const fixture = await seedSellableStock();
        const orderForm = await seedOrderForm(fixture);
        const invoice = await invoiceService.generateInvoice(
            invoicePayload(orderForm, [fixture.setCodes[0], fixture.looseCodes[0]]),
        );

        const before = await inventoryFor(fixture.variant.id, fixture.sizes[0].id);

        const updated = await invoiceService.updateInvoice(invoice.id, {
            invoiceNumber: invoice.invoiceNumber,
            party: PARTY,
            partySync: "document",
            scans: [{ scanCode: fixture.setCodes[0], method: "Manual" }],
        });

        expect(updated.totalPcs).toBe(4);
        expect(await statusOf(fixture.looseItems[0].id)).toBe("AVAILABLE");
        expect(await inventoryFor(fixture.variant.id, fixture.sizes[0].id)).toBe(before + 1);
    });

    it("consumes a newly added tag", async () => {
        const fixture = await seedSellableStock();
        const orderForm = await seedOrderForm(fixture);
        const invoice = await invoiceService.generateInvoice(invoicePayload(orderForm, [fixture.setCodes[0]]));

        const updated = await invoiceService.updateInvoice(invoice.id, {
            invoiceNumber: invoice.invoiceNumber,
            party: PARTY,
            partySync: "document",
            scans: [fixture.setCodes[0], fixture.setCodes[1]].map((scanCode) => ({ scanCode, method: "Manual" })),
        });

        expect(updated.totalPcs).toBe(8);
        expect(await statusOf(fixture.setItems[1].id)).toBe("CONSUMED");
    });

    it("leaves preparedBy and editedBy null while there is no sign-in to name a person", async () => {
        const fixture = await seedSellableStock();
        const orderForm = await seedOrderForm(fixture);
        const invoice = await invoiceService.generateInvoice(invoicePayload(orderForm, [fixture.setCodes[0]]));

        const updated = await invoiceService.updateInvoice(invoice.id, {
            invoiceNumber: invoice.invoiceNumber, party: PARTY, partySync: "document",
            scans: [{ scanCode: fixture.setCodes[1], method: "Manual" }],
        });

        // Writing a role name here would be a fabrication — the same rule stock_history follows.
        // These become real when RBAC lands.
        expect(updated.preparedBy).toBeNull();
        expect(updated.editedBy).toBeNull();
    });
});

describe("checkScan", () => {
    it("resolves an available tag with its pieces and sizes", async () => {
        const fixture = await seedSellableStock();

        const result = await invoiceService.checkScan(fixture.setCodes[0]);

        expect(result.state).toBe("OK");
        expect(result.pieces).toBe(4);
        expect(result.kind).toBe("SET");
    });

    it("reports an unknown code rather than throwing", async () => {
        expect((await invoiceService.checkScan("NOPE")).state).toBe("UNKNOWN");
    });

    it("reports a code already on the picking screen", async () => {
        const fixture = await seedSellableStock();

        const result = await invoiceService.checkScan(fixture.setCodes[0], { excludeCodes: [fixture.setCodes[0]] });

        expect(result.state).toBe("ALREADY_SCANNED");
    });

    it("reports a consumed tag as unavailable and names the invoice that billed it", async () => {
        const fixture = await seedSellableStock();
        const orderForm = await seedOrderForm(fixture);
        await invoiceService.generateInvoice(invoicePayload(orderForm, [fixture.setCodes[0]]));

        const result = await invoiceService.checkScan(fixture.setCodes[0]);

        expect(result.state).toBe("UNAVAILABLE");
        expect(result.billedOn).toBe("INV-2026-001");
    });
});
