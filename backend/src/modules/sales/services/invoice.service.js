import { db } from "../../../database/index.js";
import ApiError from "../../../core/apiError.js";

import invoiceRepository from "../repositories/invoice.repository.js";
import orderFormRepository from "../repositories/orderForm.repository.js";
import invoiceMapper from "../mapper/invoiceMapper.js";
import { partySnapshotToColumns } from "../mapper/orderFormMapper.js";
import partyResolver from "./partyResolver.service.js";
import scanResolver from "./scanResolver.service.js";
import invoiceStock from "./invoiceStock.service.js";
import { duplicateNumberError, suggestNext } from "./documentNumber.service.js";

const INVOICE_PREFIX = "INV-";

function notFoundError(id) {
    return new ApiError(`Invoice ${id} not found.`, 404, "INVOICE_NOT_FOUND");
}

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

class InvoiceService {
    _invoiceRepository = invoiceRepository;
    _orderFormRepository = orderFormRepository;
    _invoiceMapper = invoiceMapper;
    _partyResolver = partyResolver;
    _scanResolver = scanResolver;
    _invoiceStock = invoiceStock;

    // Re-resolves every scanned code server-side rather than trusting the client's description of
    // what it scanned. The browser says "I scanned these codes"; what those codes mean — which
    // pieces, which sizes, at what price — is decided here, because this is what deducts stock.
    async _resolveEntries(tx, scans) {
        const seen = new Set();
        const entries = [];

        for (const scan of scans) {
            const resolved = await this._scanResolver.resolve(scan.scanCode, { runner: tx });

            if (!resolved || resolved.state !== "OK") {
                throw new ApiError(
                    `${scan.scanCode} is not a usable tag${resolved?.state === "DUPLICATE" ? " — two physical items share this code, so it must be fixed in QR Center first" : ""}.`,
                    400,
                    "SCAN_UNRESOLVED",
                );
            }

            if (seen.has(resolved.stockItemId)) {
                throw new ApiError(`${scan.scanCode} appears twice on this invoice.`, 400, "SCAN_DUPLICATED");
            }
            seen.add(resolved.stockItemId);

            entries.push({
                stockItemId: resolved.stockItemId,
                colorVariantId: resolved.colorVariantId,
                kind: resolved.kind,
                scanCode: resolved.shortCode,
                pieces: resolved.pieces,
                sizeBreakdown: resolved.sizeBreakdown,
                unitPrice: resolved.unitPrice,
                method: scan.method ?? "Manual",
            });
        }

        return entries;
    }

    async _loadOne(runner, row) {
        if (!row) return null;

        const [entries, orderForm] = await Promise.all([
            this._invoiceRepository.findEntriesByInvoiceIds(runner, [row.id]),
            this._orderFormRepository.findById(runner, row.orderFormId),
        ]);

        const orderFormItems = orderForm
            ? await this._orderFormRepository.findItemsByFormIds(runner, [orderForm.id])
            : [];

        return this._invoiceMapper.map(row, entries, {
            orderFormNumber: orderForm?.formNumber ?? null,
            orderFormItems,
        });
    }

    async generateInvoice(payload) {
        const number = String(payload.invoiceNumber).trim();

        const created = await db.transaction(async (tx) => {
            const clash = await this._invoiceRepository.findByNumber(tx, number);
            if (clash) throw duplicateNumberError("invoice", number);

            const orderForm = await this._orderFormRepository.findById(tx, Number(payload.orderFormId));
            if (!orderForm) throw new ApiError(`Order form ${payload.orderFormId} not found.`, 404, "ORDER_FORM_NOT_FOUND");

            if (orderForm.status === "INVOICED") {
                const existing = await this._invoiceRepository.findByOrderFormId(tx, orderForm.id);
                throw new ApiError(
                    `Order form ${orderForm.formNumber} has already been invoiced as ${existing?.invoiceNumber ?? "another invoice"}.`,
                    409,
                    "ORDER_FORM_ALREADY_INVOICED",
                );
            }

            const entries = await this._resolveEntries(tx, payload.scans);
            const { partyId, snapshot } = await this._partyResolver.resolve(tx, payload);

            const invoiceDate = payload.invoiceDate || todayIso();

            const transaction = await this._invoiceStock.dispatch(tx, {
                entries,
                invoiceNumber: number,
                invoiceDate,
                partyName: snapshot.name,
            });

            const row = await this._invoiceRepository.create(tx, {
                invoiceNumber: number,
                invoiceDate,
                orderFormId: orderForm.id,
                partyId,
                ...partySnapshotToColumns(snapshot),
                salesman: orderForm.salesman ?? null,
                ticks: payload.ticks ?? {},
                stockOutTransactionId: transaction.id,
                // Null until RBAC: see invoice.schema.js.
                preparedBy: null,
                editedBy: null,
            });

            await this._invoiceRepository.createEntries(tx, entries.map((entry) => ({ ...entry, invoiceId: row.id })));
            await this._orderFormRepository.setStatus(tx, orderForm.id, "INVOICED");

            return row;
        });

        return this._loadOne(db, created);
    }

    // Recomputes the invoice from the tags now on it and moves only the difference: tags taken off go back to the shelf, tags newly added come off
    // it. Re-consuming everything would churn stock history with movements that never happened.
    async updateInvoice(id, payload) {
        const invoiceId = Number(id);
        const number = String(payload.invoiceNumber).trim();

        const updated = await db.transaction(async (tx) => {
            const existing = await this._invoiceRepository.findById(tx, invoiceId);
            if (!existing) throw notFoundError(invoiceId);

            const clash = await this._invoiceRepository.findByNumber(tx, number, invoiceId);
            if (clash) throw duplicateNumberError("invoice", number);

            const before = await this._invoiceRepository.findEntriesByInvoiceIds(tx, [invoiceId]);
            const after = await this._resolveEntries(tx, payload.scans);

            const beforeIds = new Set(before.map((entry) => entry.stockItemId));
            const afterIds = new Set(after.map((entry) => entry.stockItemId));

            const removed = before.filter((entry) => !afterIds.has(entry.stockItemId));
            const added = after.filter((entry) => !beforeIds.has(entry.stockItemId));

            // A tag added here may already be on someone else's invoice — the stock row would
            // still read AVAILABLE if that invoice restored it, so status alone is not enough.
            const conflicts = await this._invoiceRepository.findEntriesByStockItemIds(
                tx, added.map((entry) => entry.stockItemId), invoiceId,
            );

            if (conflicts.length > 0) {
                throw new ApiError(
                    `Tag ${added.find((entry) => entry.stockItemId === conflicts[0].stockItemId)?.scanCode} is already billed on ${conflicts[0].invoiceNumber}.`,
                    409,
                    "STOCK_ITEM_ALREADY_BILLED",
                );
            }

            await this._invoiceStock.restore(tx, removed);
            if (added.length > 0) {
                await this._invoiceStock.dispatch(tx, {
                    entries: added,
                    invoiceNumber: number,
                    invoiceDate: payload.invoiceDate || existing.invoiceDate,
                    partyName: payload.party?.name ?? existing.partyName,
                });
            }

            const { partyId, snapshot } = await this._partyResolver.resolve(tx, payload);

            const row = await this._invoiceRepository.update(tx, invoiceId, {
                invoiceNumber: number,
                invoiceDate: payload.invoiceDate || existing.invoiceDate,
                partyId,
                ...partySnapshotToColumns(snapshot),
                ticks: payload.ticks ?? existing.ticks ?? {},
            });

            await this._invoiceRepository.deleteEntries(tx, invoiceId);
            await this._invoiceRepository.createEntries(tx, after.map((entry) => ({ ...entry, invoiceId })));

            return row;
        });

        return this._loadOne(db, updated);
    }

    // Checks one code as it is scanned, so the picker gets an answer per scan instead of a wall
    // of errors on save. Read-only.
    async checkScan(code, { excludeCodes = [], invoiceId } = {}) {
        const resolved = await this._scanResolver.resolve(code);

        if (!resolved) return { state: "UNKNOWN", scanCode: String(code).trim().toUpperCase() };
        if (resolved.state !== "OK") return resolved;

        const alreadyScanned = excludeCodes.some((scanned) => String(scanned).trim().toUpperCase() === resolved.shortCode);
        if (alreadyScanned) return { ...resolved, state: "ALREADY_SCANNED" };

        if (resolved.status !== "AVAILABLE") {
            const billed = await this._invoiceRepository.findEntriesByStockItemIds(db, [resolved.stockItemId], invoiceId ? Number(invoiceId) : undefined);

            return {
                ...resolved,
                state: "UNAVAILABLE",
                billedOn: billed[0]?.invoiceNumber ?? null,
            };
        }

        return resolved;
    }

    async getInvoice(id) {
        const row = await this._invoiceRepository.findById(db, Number(id));
        if (!row) throw notFoundError(id);

        return this._loadOne(db, row);
    }

    async getInvoiceByNumber(invoiceNumber) {
        const row = await this._invoiceRepository.findByNumber(db, invoiceNumber);
        if (!row) throw new ApiError(`No invoice ${invoiceNumber} found.`, 404, "INVOICE_NOT_FOUND");

        return this._loadOne(db, row);
    }

    async listInvoices({ page = 1, limit = 50, q, from, to } = {}) {
        const offset = (page - 1) * limit;
        const filters = { keyword: q?.trim() || undefined, from, to };

        const [rows, total] = await Promise.all([
            this._invoiceRepository.findMany(db, { limit, offset, ...filters }),
            this._invoiceRepository.count(db, filters),
        ]);

        const entries = await this._invoiceRepository.findEntriesByInvoiceIds(db, rows.map(({ invoice }) => invoice.id));
        const entriesByInvoiceId = entries.reduce((map, entry) => {
            const list = map.get(entry.invoiceId) ?? [];
            list.push(entry);
            map.set(entry.invoiceId, list);
            return map;
        }, new Map());

        return {
            data: this._invoiceMapper.mapMany(rows, entriesByInvoiceId),
            meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        };
    }

    async checkNumber(invoiceNumber, excludeId) {
        const clash = await this._invoiceRepository.findByNumber(db, invoiceNumber, excludeId ? Number(excludeId) : undefined);

        return { invoiceNumber: String(invoiceNumber).trim(), available: !clash };
    }

    async suggestNumber() {
        const highest = await this._invoiceRepository.findHighestNumber(db, INVOICE_PREFIX);

        return { invoiceNumber: suggestNext(highest, `${INVOICE_PREFIX}${new Date().getFullYear()}-`) };
    }
}

export default new InvoiceService();
