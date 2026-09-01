import { partyFromColumns } from "./orderFormMapper.js";

// Rolls scanned tags up into the lines a printed invoice shows. This is the derivation the whole
// design rests on: nothing here is stored, so what was billed and what left the godown cannot
// drift apart.
export function aggregateEntries(entries) {
    const byVariant = new Map();

    for (const entry of entries) {
        const existing = byVariant.get(entry.colorVariantId) ?? {
            colorVariantId: entry.colorVariantId,
            designId: entry.designId,
            designCode: entry.designCode,
            designName: entry.designName,
            itemName: entry.itemName ?? null,
            quality: entry.quality ?? null,
            colorName: entry.colorName,
            colorHex: entry.colorHex,
            imageUrl: entry.imageUrl,
            unitPrice: Number(entry.unitPrice ?? 0),
            pieces: 0,
            sets: 0,
            bundles: 0,
            singles: 0,
            sizes: {},
            tags: [],
        };

        existing.pieces += entry.pieces;

        if (entry.kind === "SET") existing.sets += 1;
        else if (entry.kind === "BUNDLE") existing.bundles += 1;
        else existing.singles += 1;

        for (const size of entry.sizeBreakdown ?? []) {
            existing.sizes[size.sizeLabel] = (existing.sizes[size.sizeLabel] ?? 0) + size.quantity;
        }

        existing.tags.push({
            stockItemId: entry.stockItemId,
            scanCode: entry.scanCode,
            kind: entry.kind,
            pieces: entry.pieces,
            sizeBreakdown: entry.sizeBreakdown,
            method: entry.method,
            scannedAt: entry.scannedAt,
        });

        byVariant.set(entry.colorVariantId, existing);
    }

    return [...byVariant.values()].map((line) => ({
        ...line,
        amount: line.pieces * line.unitPrice,
        // "2 sets + 1 pc" — how the goods were physically packed, which is what the receiver
        // checks the carton against.
        packedAs: [
            line.sets ? `${line.sets} set${line.sets > 1 ? "s" : ""}` : "",
            line.bundles ? `${line.bundles} bundle${line.bundles > 1 ? "s" : ""}` : "",
            line.singles ? `${line.singles} pc${line.singles > 1 ? "s" : ""}` : "",
        ].filter(Boolean).join(" + "),
    }));
}

class InvoiceMapper {
    map(row, entries = [], { orderFormNumber, orderFormItems } = {}) {
        if (!row) return null;

        const lines = aggregateEntries(entries);
        const totalPcs = lines.reduce((total, line) => total + line.pieces, 0);
        const totalAmount = lines.reduce((total, line) => total + line.amount, 0);

        // Anything billed that the order form never asked for. Surfaced rather than hidden: an
        // extra on a bill is exactly the thing a customer disputes.
        const orderedVariantIds = new Set((orderFormItems ?? []).map((item) => item.colorVariantId));
        const decorated = lines.map((line) => ({
            ...line,
            isExtra: orderedVariantIds.size > 0 && !orderedVariantIds.has(line.colorVariantId),
        }));

        return {
            id: row.id,
            invoiceNumber: row.invoiceNumber,
            invoiceDate: row.invoiceDate,
            orderFormId: row.orderFormId,
            orderFormNumber: orderFormNumber ?? row.orderFormNumber ?? null,
            partyId: row.partyId,
            party: partyFromColumns(row),
            salesman: row.salesman ?? "",
            ticks: row.ticks ?? {},
            preparedBy: row.preparedBy,
            editedBy: row.editedBy,
            stockOutTransactionId: row.stockOutTransactionId,
            lines: decorated,
            totalPcs,
            totalAmount,
            totalVariants: decorated.length,
            totalTags: entries.length,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    mapMany(rows, entriesByInvoiceId) {
        return rows.map(({ invoice: row, orderFormNumber }) =>
            this.map(row, entriesByInvoiceId.get(row.id) ?? [], { orderFormNumber }));
    }
}

export default new InvoiceMapper();
