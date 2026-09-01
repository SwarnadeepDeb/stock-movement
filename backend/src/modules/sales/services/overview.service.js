import { db } from "../../../database/index.js";

import partyRepository from "../repositories/party.repository.js";
import orderFormRepository from "../repositories/orderForm.repository.js";
import invoiceRepository from "../repositories/invoice.repository.js";

function monthBounds(today = new Date()) {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const iso = (date) => date.toISOString().slice(0, 10);

    return { from: iso(first), to: iso(last) };
}

// The Stock Out overview's numbers. One endpoint rather than four, because the screen shows them
// together and four round trips to render one card is waste.
class OverviewService {
    _partyRepository = partyRepository;
    _orderFormRepository = orderFormRepository;
    _invoiceRepository = invoiceRepository;

    async getSummary() {
        const { from, to } = monthBounds();

        const [partyCount, statusCounts, month, recentOrderForms, recentInvoices] = await Promise.all([
            this._partyRepository.count(db, {}),
            this._orderFormRepository.countByStatus(db),
            this._invoiceRepository.summarize(db, { from, to }),
            this._orderFormRepository.findMany(db, { limit: 5, offset: 0 }),
            this._invoiceRepository.findMany(db, { limit: 5, offset: 0 }),
        ]);

        const byStatus = statusCounts.reduce((counts, row) => ({ ...counts, [row.status]: row.value }), {});

        return {
            partyCount,
            openOrderForms: byStatus.OPEN ?? 0,
            invoicedOrderForms: byStatus.INVOICED ?? 0,
            invoicesThisMonth: month.invoices,
            piecesThisMonth: month.pieces,
            amountThisMonth: Number(month.amount),
            recentOrderForms: recentOrderForms.map((row) => ({
                id: row.id,
                formNumber: row.formNumber,
                formDate: row.formDate,
                partyName: row.partyName,
                status: row.status,
            })),
            recentInvoices: recentInvoices.map(({ invoice, orderFormNumber }) => ({
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                invoiceDate: invoice.invoiceDate,
                partyName: invoice.partyName,
                orderFormNumber,
            })),
        };
    }
}

export default new OverviewService();
