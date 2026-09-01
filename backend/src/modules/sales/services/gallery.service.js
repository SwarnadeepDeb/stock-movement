import { db } from "../../../database/index.js";

import orderFormService from "./orderForm.service.js";
import invoiceService from "./invoice.service.js";
import colorVariantRepository from "../../design/repositories/colorVariant.repository.js";
import variantInventoryRepository from "../../inventory/repositories/variantInventory.repository.js";

// The photos a salesperson sends to a customer. Every photo is the colour variant's own image
// from Design Master — there is no per-document upload, so a design photographed once is correct
// on every order form and invoice that ever references it.
class GalleryService {
    _orderFormService = orderFormService;
    _invoiceService = invoiceService;
    _colorVariantRepository = colorVariantRepository;
    _variantInventoryRepository = variantInventoryRepository;

    _item({ colorVariantId, designId, designCode, designName, itemName, quality, colorName, colorHex, imageUrl, unitPrice, label, availablePcs, isExtra }) {
        return {
            colorVariantId,
            designId,
            designCode,
            designName,
            // The Gallery's filter facets — designName is the pattern (see design.schema.js).
            itemName: itemName ?? null,
            quality: quality ?? null,
            // Per-piece selling price from Design Master — drives the price filter and the rate shown on each photo.
            unitPrice: Number(unitPrice ?? 0),
            colorName,
            colorHex,
            imageUrl: imageUrl ?? null,
            // A variant registered without a photo can't be shared, and the screen says so rather
            // than showing a broken image.
            hasPhoto: Boolean(imageUrl),
            label,
            availablePcs: availablePcs ?? null,
            isExtra: Boolean(isExtra),
        };
    }

    async byOrderForm(formNumber) {
        const orderForm = await this._orderFormService.getOrderFormByNumber(formNumber);

        return {
            source: { kind: "orderForm", number: orderForm.formNumber, party: orderForm.party.name, date: orderForm.formDate, totalPcs: orderForm.totalPcs, id: orderForm.id },
            items: orderForm.items.map((item) => this._item({ ...item, label: `${item.quantityPcs} pcs requested` })),
        };
    }

    async byInvoice(invoiceNumber) {
        const invoice = await this._invoiceService.getInvoiceByNumber(invoiceNumber);

        return {
            source: { kind: "invoice", number: invoice.invoiceNumber, party: invoice.party.name, date: invoice.invoiceDate, totalPcs: invoice.totalPcs, totalAmount: invoice.totalAmount, orderFormNumber: invoice.orderFormNumber, id: invoice.id },
            items: invoice.lines.map((line) => this._item({ ...line, label: `${line.pieces} pcs billed`, isExtra: line.isExtra })),
        };
    }

    // Every active variant, for browsing the whole catalogue rather than one document. The
    // Gallery screen sends no q/stock and filters on the client, so its facet counts can see the
    // whole catalogue; both are still honoured for other callers.
    async all({ q, designId, stock } = {}) {
        const variants = await this._colorVariantRepository.findAllActiveWithDesign(db, { keyword: q?.trim() || undefined, designId });

        const totals = await this._variantInventoryRepository.sumQuantityByColorVariantIds(variants.map((variant) => variant.colorVariantId));
        const availableByVariantId = new Map(totals.map((row) => [row.colorVariantId, row.totalPieces]));

        const items = variants.map((variant) => {
            const availablePcs = availableByVariantId.get(variant.colorVariantId) ?? 0;

            return this._item({
                ...variant,
                availablePcs,
                label: availablePcs ? `${availablePcs} pcs in stock` : "Out of stock",
            });
        });

        const filtered = stock === "in" ? items.filter((item) => item.availablePcs > 0)
            : stock === "out" ? items.filter((item) => item.availablePcs === 0)
            : items;

        return { source: { kind: "all", number: null, party: null }, items: filtered };
    }
}

export default new GalleryService();
