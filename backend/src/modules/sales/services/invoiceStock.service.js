import ApiError from "../../../core/apiError.js";

import stockItemRepository from "../../stock/repositories/stockItem.repository.js";
import stockOutTransactionRepository from "../../stock/repositories/stockOutTransaction.repository.js";
import stockOutEntryRepository from "../../stock/repositories/stockOutEntry.repository.js";
import stockHistoryRepository from "../../stock/repositories/stockHistory.repository.js";
import variantInventoryRepository from "../../inventory/repositories/variantInventory.repository.js";

// Everything that touches stock when an invoice is generated or edited. Kept apart from
// invoice.service.js because this is the dangerous half: it is the only path in Stock Out that
// removes garments from inventory, and it should be readable on its own.
//
// Every method takes a transaction. None of them opens one — the caller owns the boundary, so a
// half-deducted invoice is impossible.
class InvoiceStockService {
    _stockItemRepository = stockItemRepository;
    _stockOutTransactionRepository = stockOutTransactionRepository;
    _stockOutEntryRepository = stockOutEntryRepository;
    _stockHistoryRepository = stockHistoryRepository;
    _variantInventoryRepository = variantInventoryRepository;

    // Per-size deltas across a set of entries. Negative when dispatching, positive when an edit
    // puts stock back.
    _inventoryRows(entries, sign) {
        const totals = new Map();

        for (const entry of entries) {
            for (const size of entry.sizeBreakdown) {
                const key = `${entry.colorVariantId}:${size.designSizeId}`;
                const current = totals.get(key) ?? { colorVariantId: entry.colorVariantId, designSizeId: size.designSizeId, quantity: 0 };
                current.quantity += sign * size.quantity;
                totals.set(key, current);
            }
        }

        return [...totals.values()].filter((row) => row.quantity !== 0 && row.designSizeId != null);
    }

    // Guards the one thing that must never happen: billing a garment that is not on the shelf.
    // Checked inside the caller's transaction, immediately before consuming, so a tag scanned
    // into two open invoice screens can only be billed by whichever saves first.
    async assertAvailable(tx, entries) {
        const ids = entries.map((entry) => entry.stockItemId);
        if (ids.length === 0) return;

        const rows = await this._stockItemRepository.findByIds(tx, ids);
        const byId = new Map(rows.map((row) => [row.id, row]));

        for (const entry of entries) {
            const row = byId.get(entry.stockItemId);

            if (!row) {
                throw new ApiError(`Tag ${entry.scanCode} no longer exists in stock.`, 409, "STOCK_ITEM_MISSING");
            }

            if (row.status !== "AVAILABLE") {
                throw new ApiError(
                    `Tag ${entry.scanCode} is no longer available — it was ${row.status === "CONSUMED" ? "already sold or consumed" : "moved out of the sellable pool"} before this invoice was saved.`,
                    409,
                    "STOCK_ITEM_UNAVAILABLE",
                );
            }
        }
    }

    // Writes the stock movement for a set of entries: the transaction row Stock History links
    // to, one stock_out_entry per variant+size, the piece-level status change, and the inventory
    // projection.
    async dispatch(tx, { entries, invoiceNumber, invoiceDate, partyName }) {
        if (entries.length === 0) {
            throw new ApiError("An invoice must have at least one scanned tag.", 400, "INVOICE_EMPTY");
        }

        await this.assertAvailable(tx, entries);

        const transaction = await this._stockOutTransactionRepository.create(tx, {
            transactionDate: new Date(`${invoiceDate}T00:00:00`),
            notes: `${invoiceNumber} · ${partyName}`,
        });

        await this._stockItemRepository.markConsumed(tx, entries.map((entry) => entry.stockItemId));

        const inventoryRows = this._inventoryRows(entries, -1);
        if (inventoryRows.length > 0) {
            await this._variantInventoryRepository.upsertIncrement(tx, inventoryRows);
        }

        const outRows = inventoryRows.map((row) => ({
            stockOutTransactionId: transaction.id,
            colorVariantId: row.colorVariantId,
            designSizeId: row.designSizeId,
            // stock_out_entries records quantity dispatched, so the sign is flipped back.
            quantity: -row.quantity,
            unitPrice: entries.find((entry) => entry.colorVariantId === row.colorVariantId)?.unitPrice ?? 0,
        }));

        if (outRows.length > 0) {
            await this._stockOutEntryRepository.createMany(tx, outRows);
        }

        await this._writeHistory(tx, { entries, transactionId: transaction.id, invoiceNumber });

        return transaction;
    }

    // One STOCK_OUT row per colour variant, matching how Stock In and the assembly flows record
    // events. performedBy stays null: the schema comment forbids inventing a user id, and a role
    // name is not one.
    async _writeHistory(tx, { entries, transactionId, invoiceNumber }) {
        const byVariant = new Map();

        for (const entry of entries) {
            const current = byVariant.get(entry.colorVariantId) ?? { pieces: 0, tags: [] };
            current.pieces += entry.pieces;
            current.tags.push({ scanCode: entry.scanCode, kind: entry.kind, pieces: entry.pieces });
            byVariant.set(entry.colorVariantId, current);
        }

        for (const [colorVariantId, summary] of byVariant) {
            await this._stockHistoryRepository.create(tx, {
                eventType: "STOCK_OUT",
                colorVariantId,
                stockOutTransactionId: transactionId,
                quantity: summary.pieces,
                metadata: { invoiceNumber, tags: summary.tags },
                performedBy: null,
            });
        }
    }

    // An edit that drops a tag: the garment never left, so it returns to the shelf and the
    // inventory projection is credited back.
    async restore(tx, entries) {
        if (entries.length === 0) return;

        await this._stockItemRepository.markAvailable(tx, entries.map((entry) => entry.stockItemId));

        const inventoryRows = this._inventoryRows(entries, 1);
        if (inventoryRows.length > 0) {
            await this._variantInventoryRepository.upsertIncrement(tx, inventoryRows);
        }
    }
}

export default new InvoiceStockService();
