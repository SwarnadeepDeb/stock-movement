const PARTY_COLUMNS = {
    name: "partyName",
    mobile: "partyMobile",
    city: "partyCity",
    gst: "partyGst",
    transport: "partyTransport",
    agent: "partyAgent",
};

// Documents store the party's details as six flat columns (a frozen snapshot), but every client
// wants one `party` object shaped like a party. These two functions are the only place that
// translation happens.
export function partySnapshotToColumns(snapshot) {
    return Object.entries(PARTY_COLUMNS).reduce((row, [field, column]) => {
        const value = String(snapshot?.[field] ?? "").trim();
        row[column] = field === "name" ? value : (value === "" ? null : value);
        return row;
    }, {});
}

export function partyFromColumns(row) {
    return Object.entries(PARTY_COLUMNS).reduce((party, [field, column]) => {
        party[field] = row[column] ?? "";
        return party;
    }, {});
}

function groupItemsByDesign(items) {
    const byDesign = new Map();

    for (const item of items) {
        if (!byDesign.has(item.designId)) {
            byDesign.set(item.designId, {
                designId: item.designId,
                designCode: item.designCode,
                designName: item.designName,
                unitPrice: Number(item.unitPrice ?? 0),
                variants: [],
            });
        }

        byDesign.get(item.designId).variants.push({
            colorVariantId: item.colorVariantId,
            colorName: item.colorName,
            colorHex: item.colorHex,
            imageUrl: item.imageUrl,
            quantityPcs: item.quantityPcs,
            availablePcs: item.availablePcs ?? null,
        });
    }

    return [...byDesign.values()];
}

class OrderFormMapper {
    map(row, items = []) {
        if (!row) return null;

        const lines = items.map((item) => ({
            colorVariantId: item.colorVariantId,
            designId: item.designId,
            designCode: item.designCode,
            designName: item.designName,
            itemName: item.itemName ?? null,
            quality: item.quality ?? null,
            colorName: item.colorName,
            colorHex: item.colorHex,
            imageUrl: item.imageUrl,
            unitPrice: Number(item.unitPrice ?? 0),
            quantityPcs: item.quantityPcs,
            availablePcs: item.availablePcs ?? null,
        }));

        return {
            id: row.id,
            formNumber: row.formNumber,
            formDate: row.formDate,
            partyId: row.partyId,
            party: partyFromColumns(row),
            salesman: row.salesman ?? "",
            notes: row.notes ?? "",
            status: row.status,
            preparedBy: row.preparedBy,
            invoice: row.invoice ?? null,
            items: lines,
            designs: groupItemsByDesign(lines),
            totalPcs: lines.reduce((total, line) => total + line.quantityPcs, 0),
            totalVariants: lines.length,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    mapMany(rows, itemsByFormId) {
        return rows.map((row) => this.map(row, itemsByFormId.get(row.id) ?? []));
    }
}

export default new OrderFormMapper();
