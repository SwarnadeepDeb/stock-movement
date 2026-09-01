import { db } from "../../../database/index.js";
import ApiError from "../../../core/apiError.js";

import orderFormRepository from "../repositories/orderForm.repository.js";
import orderFormMapper, { partySnapshotToColumns } from "../mapper/orderFormMapper.js";
import partyResolver from "./partyResolver.service.js";
import variantInventoryRepository from "../../inventory/repositories/variantInventory.repository.js";
import invoiceRepository from "../repositories/invoice.repository.js";
import { duplicateNumberError, suggestNext } from "./documentNumber.service.js";

const ORDER_FORM_PREFIX = "OF-";

function notFoundError(id) {
    return new ApiError(`Order form ${id} not found.`, 404, "ORDER_FORM_NOT_FOUND");
}

function normalizeSalesman(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim() || null;
}

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

class OrderFormService {
    _orderFormRepository = orderFormRepository;
    _orderFormMapper = orderFormMapper;
    _partyResolver = partyResolver;
    _variantInventoryRepository = variantInventoryRepository;
    _invoiceRepository = invoiceRepository;

    // Live availability per variant, attached to every line so the screen can say "short by 3"
    // without the client computing it. Availability never blocks an order form — it is a
    // requirement list, and a customer is allowed to ask for more than is in the godown.
    async _withAvailability(items) {
        const variantIds = [...new Set(items.map((item) => item.colorVariantId))];
        if (variantIds.length === 0) return items;

        const totals = await this._variantInventoryRepository.sumQuantityByColorVariantIds(variantIds);
        const availableByVariantId = new Map(totals.map((row) => [row.colorVariantId, row.totalPieces]));

        return items.map((item) => ({ ...item, availablePcs: availableByVariantId.get(item.colorVariantId) ?? 0 }));
    }

    async _loadOne(runner, row) {
        if (!row) return null;

        const items = await this._withAvailability(await this._orderFormRepository.findItemsByFormIds(runner, [row.id]));
        const invoice = await this._invoiceRepository.findByOrderFormId(runner, row.id);

        return this._orderFormMapper.map(
            { ...row, invoice: invoice ? { id: invoice.id, invoiceNumber: invoice.invoiceNumber } : null },
            items,
        );
    }

    async createOrderForm(payload) {
        const number = String(payload.formNumber).trim();

        const created = await db.transaction(async (tx) => {
            const clash = await this._orderFormRepository.findByNumber(tx, number);
            if (clash) throw duplicateNumberError("orderForm", number);

            const { partyId, snapshot } = await this._partyResolver.resolve(tx, payload);

            const row = await this._orderFormRepository.create(tx, {
                formNumber: number,
                formDate: payload.formDate || todayIso(),
                partyId,
                ...partySnapshotToColumns(snapshot),
                salesman: normalizeSalesman(payload.salesman),
                notes: payload.notes?.trim() || null,
                status: "OPEN",
                // Null until RBAC: see orderForm.schema.js.
                preparedBy: null,
            });

            await this._orderFormRepository.replaceItems(tx, row.id, payload.items);

            return row;
        });

        return this._loadOne(db, created);
    }

    async updateOrderForm(id, payload) {
        const formId = Number(id);
        const number = String(payload.formNumber).trim();

        const updated = await db.transaction(async (tx) => {
            const existing = await this._orderFormRepository.findById(tx, formId);
            if (!existing) throw notFoundError(formId);

            // An invoiced order form is the checklist an invoice was built against. Editing it
            // would silently rewrite what that invoice claims was ordered.
            if (existing.status === "INVOICED") {
                throw new ApiError(
                    `Order form ${existing.formNumber} has already been invoiced and can no longer be edited.`,
                    409,
                    "ORDER_FORM_LOCKED",
                );
            }

            const clash = await this._orderFormRepository.findByNumber(tx, number, formId);
            if (clash) throw duplicateNumberError("orderForm", number);

            const { partyId, snapshot } = await this._partyResolver.resolve(tx, payload);

            const row = await this._orderFormRepository.update(tx, formId, {
                formNumber: number,
                formDate: payload.formDate || existing.formDate,
                partyId,
                ...partySnapshotToColumns(snapshot),
                salesman: normalizeSalesman(payload.salesman),
                notes: payload.notes?.trim() || null,
            });

            await this._orderFormRepository.replaceItems(tx, formId, payload.items);

            return row;
        });

        return this._loadOne(db, updated);
    }

    async cancelOrderForm(id) {
        const formId = Number(id);

        const existing = await this._orderFormRepository.findById(db, formId);
        if (!existing) throw notFoundError(formId);

        if (existing.status === "INVOICED") {
            throw new ApiError(
                `Order form ${existing.formNumber} has been invoiced and cannot be cancelled.`,
                409,
                "ORDER_FORM_LOCKED",
            );
        }

        const row = await this._orderFormRepository.setStatus(db, formId, "CANCELLED");

        return this._loadOne(db, row);
    }

    async getOrderForm(id) {
        const row = await this._orderFormRepository.findById(db, Number(id));
        if (!row) throw notFoundError(id);

        return this._loadOne(db, row);
    }

    // Fetching by the number the user typed is the primary path in the invoice screen and the
    // gallery, where nobody knows or cares about row ids.
    async getOrderFormByNumber(formNumber) {
        const row = await this._orderFormRepository.findByNumber(db, formNumber);
        if (!row) throw new ApiError(`No order form ${formNumber} found.`, 404, "ORDER_FORM_NOT_FOUND");

        return this._loadOne(db, row);
    }

    async listOrderForms({ page = 1, limit = 50, q, status } = {}) {
        const offset = (page - 1) * limit;
        const filters = { keyword: q?.trim() || undefined, status };

        const [rows, total, statusCounts] = await Promise.all([
            this._orderFormRepository.findMany(db, { limit, offset, ...filters }),
            this._orderFormRepository.count(db, filters),
            this._orderFormRepository.countByStatus(db),
        ]);

        const items = await this._orderFormRepository.findItemsByFormIds(db, rows.map((row) => row.id));
        const invoices = await this._invoiceRepository.findByOrderFormIds(db, rows.map((row) => row.id));
        const invoiceByFormId = new Map(invoices.map((row) => [row.orderFormId, row]));

        const itemsByFormId = items.reduce((map, item) => {
            const list = map.get(item.orderFormId) ?? [];
            list.push(item);
            map.set(item.orderFormId, list);
            return map;
        }, new Map());

        const decorated = rows.map((row) => {
            const found = invoiceByFormId.get(row.id);
            return { ...row, invoice: found ? { id: found.id, invoiceNumber: found.invoiceNumber } : null };
        });

        return {
            data: this._orderFormMapper.mapMany(decorated, itemsByFormId),
            meta: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
                statusCounts: statusCounts.reduce((counts, row) => ({ ...counts, [row.status]: row.value }), {}),
            },
        };
    }

    async checkNumber(formNumber, excludeId) {
        const clash = await this._orderFormRepository.findByNumber(db, formNumber, excludeId ? Number(excludeId) : undefined);

        return { formNumber: String(formNumber).trim(), available: !clash };
    }

    async suggestNumber() {
        const highest = await this._orderFormRepository.findHighestNumber(db, ORDER_FORM_PREFIX);

        return { formNumber: suggestNext(highest, ORDER_FORM_PREFIX) };
    }
}

export default new OrderFormService();
