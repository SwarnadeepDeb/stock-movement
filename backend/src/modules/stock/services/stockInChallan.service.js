import { db } from "../../../database/index.js";
import ApiError from "../../../core/apiError.js";

import stockInChallanRepository from "../repositories/stockInChallan.repository.js";
import stockItemRepository from "../repositories/stockItem.repository.js";
import stockItemQrRepository from "../repositories/stockItemQr.repository.js";
import variantInventoryRepository from "../../inventory/repositories/variantInventory.repository.js";
import stockHistoryService from "./stockHistory.service.js";

// No auth module yet — same stand-in the adjustments use.
const DEFAULT_ACTOR = "Staff";

const SERIAL_PREFIX = "SF-";
export const formatSerial = (serial) => `${SERIAL_PREFIX}${String(serial).padStart(4, "0")}`;

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

function toIsoDate(value) {
    if (!value) return value;
    if (typeof value === "string") return value.slice(0, 10);
    return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Raw SQL hands timestamp columns back as "YYYY-MM-DD HH:MM:SS.ffffff" strings (server time, UTC).
// Normalised to ISO so every browser parses them the same way.
function toIsoTimestamp(value) {
    if (!value) return value;
    if (value instanceof Date) return value.toISOString();
    return new Date(`${String(value).replace(" ", "T")}Z`).toISOString();
}

function printStatus(qrCount, printedCount) {
    if (qrCount === 0) return "NONE";
    if (printedCount === 0) return "NOT_PRINTED";
    if (printedCount < qrCount) return "PARTIAL";
    return "PRINTED";
}

function toRowView(row) {
    return {
        id: row.id,
        serial: row.serial,
        serialLabel: formatSerial(row.serial),
        jobberName: row.jobber_name,
        challanNo: row.challan_no,
        issuedChallanNo: row.issued_challan_no,
        stockDate: toIsoDate(row.stock_date),
        status: row.status,
        remarks: row.remarks,
        enteredBy: row.entered_by,
        createdAt: toIsoTimestamp(row.created_at),
        totalPieces: row.total_pieces,
        sets: row.sets,
        semiSets: row.semi_sets,
        loosePieces: row.loose,
        defective: row.defective,
        edited: row.edit_count > 0,
        qrCount: row.qr_count,
        printedCount: row.printed_count,
        printStatus: printStatus(row.qr_count, row.printed_count),
        designs: row.designs ?? [],
        // Lets the dashboard deep-link a single-variant challan straight to its QR grid.
        qrGridTransactionId: row.transaction_count === 1 ? row.first_transaction_id : null,
    };
}

class StockInChallanService {
    _repository = stockInChallanRepository;
    _stockItemRepository = stockItemRepository;
    _stockItemQrRepository = stockItemQrRepository;
    _variantInventoryRepository = variantInventoryRepository;
    _stockHistoryService = stockHistoryService;

    async list(query) {
        const { page, limit } = query;
        const filters = { ...query, offset: (page - 1) * limit };

        const [rows, total, counts, serials, jobbers] = await Promise.all([
            this._repository.list(db, filters),
            this._repository.count(db, filters),
            this._repository.statusCounts(db),
            this._repository.serialRange(db),
            this._repository.jobberNames(db),
        ]);

        return {
            items: rows.map(toRowView),
            total,
            page,
            limit,
            counts,
            jobbers,
            serials: {
                first: serials.first ? formatSerial(serials.first) : null,
                last: serials.last ? formatSerial(serials.last) : null,
                next: formatSerial(serials.last + 1),
                dropped: serials.dropped.map(formatSerial),
            },
        };
    }

    async nextSerial() {
        return formatSerial(await this._repository.peekNextSerial(db));
    }

    async jobberSummary() {
        const rows = await this._repository.jobberSummary(db);
        return rows.map((row) => ({ jobberName: row.jobber_name ?? "—", challanCount: row.challan_count, pieces: row.pieces }));
    }

    async getById(id) {
        const challan = await this._repository.findById(db, id);
        if (!challan) throw new ApiError("Challan not found.", 404, "NOT_FOUND");

        const [lineRows, events, listRow] = await Promise.all([
            this._repository.findLines(db, id),
            this._repository.findEvents(db, id),
            this._repository.list(db, { id, status: "all", sort: "new", limit: 1, offset: 0 }),
        ]);

        const transactionIds = lineRows.map((line) => line.transaction_id);
        const variantIds = lineRows.map((line) => line.variant_id);
        const [bundleRows, looseRows, sizeRows] = await Promise.all([
            this._repository.findLineBundles(db, transactionIds),
            this._repository.findLineLoose(db, transactionIds),
            this._repository.findLineSizes(db, variantIds),
        ]);

        const summary = toRowView(listRow[0]);

        const lines = lineRows.map((line) => {
            const semiSets = bundleRows
                .filter((bundle) => bundle.transaction_id === line.transaction_id)
                .map((bundle) => ({ sizes: bundle.sizes, quantity: bundle.quantity, piecesEach: bundle.piece_quantities.reduce((sum, q) => sum + q, 0) }));
            const loose = {};
            looseRows.filter((row) => row.transaction_id === line.transaction_id).forEach((row) => { loose[row.size_label] = (loose[row.size_label] ?? 0) + row.quantity; });
            const sizes = sizeRows.filter((size) => size.variant_id === line.variant_id).map((size) => size.size_label);

            return {
                transactionId: line.transaction_id,
                designId: line.design_id,
                designCode: line.design_code,
                designName: line.design_name,
                colorName: line.color_name,
                colorHex: line.color_hex,
                sizes,
                sets: line.sets,
                semiSets,
                semiSetCount: semiSets.reduce((sum, bundle) => sum + bundle.quantity, 0),
                loose,
                loosePieces: Object.values(loose).reduce((sum, q) => sum + q, 0),
                pieces: line.pieces,
                defective: line.defective_pieces,
                defectCategory: line.defect_category,
            };
        });

        return {
            ...summary,
            defectAction: challan.defectAction,
            voidReason: challan.voidReason,
            voidedAt: challan.voidedAt ? toIsoTimestamp(challan.voidedAt) : null,
            lines,
            events: events.map((event) => ({
                id: event.id, kind: event.kind, note: event.note, changes: event.changes, actor: event.actor, createdAt: toIsoTimestamp(event.created_at),
            })),
        };
    }

    // Corrects the challan's details. Quantities are never edited — QR tags already exist for
    // every piece — a wrong count is fixed by dropping the challan and entering it again.
    async update(id, data) {
        return db.transaction(async (tx) => {
            const challan = await this._repository.findByIdForUpdate(tx, id);
            if (!challan) throw new ApiError("Challan not found.", 404, "NOT_FOUND");
            if (challan.status === "DROPPED") throw new ApiError("A dropped challan can't be edited.", 409, "CHALLAN_DROPPED");
            if (data.stockDate > todayIso()) throw new ApiError("Inward date can't be in the future.", 400, "FUTURE_DATE");

            const duplicate = await this._repository.findActiveDuplicate(tx, { jobberName: data.jobberName, challanNo: data.challanNo, excludeId: id });
            if (duplicate) {
                throw new ApiError(`${data.jobberName} already has challan ${data.challanNo} (${formatSerial(duplicate.serial)}).`, 409, "DUPLICATE_CHALLAN");
            }

            const next = {
                jobberName: data.jobberName,
                challanNo: data.challanNo,
                issuedChallanNo: data.issuedChallanNo || null,
                stockDate: data.stockDate,
                remarks: data.remarks || null,
            };
            const before = {
                jobberName: challan.jobber_name,
                challanNo: challan.challan_no,
                issuedChallanNo: challan.issued_challan_no,
                stockDate: toIsoDate(challan.stock_date),
                remarks: challan.remarks,
            };
            const labels = { jobberName: "Jobber", challanNo: "Jobber challan no.", issuedChallanNo: "Issued challan no.", stockDate: "Inward date", remarks: "QC remarks" };
            const changes = Object.keys(labels)
                .filter((field) => (before[field] ?? "") !== (next[field] ?? ""))
                .map((field) => ({ field: labels[field], from: before[field] ?? "", to: next[field] ?? "" }));

            if (changes.length === 0) throw new ApiError("Nothing changed.", 400, "NO_CHANGES");

            await this._repository.update(tx, id, next);
            // The per-variant registrations carry the challan no. and date too (QR Center and
            // Stock History read them), so they follow the challan.
            await this._repository.linkTransactionsToChallan(tx, id, { challanNo: next.challanNo, stockDate: next.stockDate });
            await this._repository.addEvent(tx, { challanId: id, kind: "EDIT", note: data.reason, changes, actor: DEFAULT_ACTOR });

            return { id, changes };
        }).then(() => this.getById(id));
    }

    // Takes the whole challan back out of stock. Refused once any of its pieces have been sold,
    // written off or moved — those corrections belong in Current Stock, where each is logged.
    async drop(id, { reason }) {
        await db.transaction(async (tx) => {
            const challan = await this._repository.findByIdForUpdate(tx, id);
            if (!challan) throw new ApiError("Challan not found.", 404, "NOT_FOUND");
            if (challan.status === "DROPPED") throw new ApiError("This challan is already dropped.", 409, "CHALLAN_DROPPED");

            const items = await this._repository.lockStockItems(tx, id);
            const gone = items.filter((item) => item.status === "CONSUMED" || item.custody_type !== "STOCK").length;
            if (gone > 0) {
                throw new ApiError(
                    `${gone} piece(s) from this challan have already been sold, written off or moved, so it can't be dropped. Use Add stock / Write off in Current Stock to correct the counts.`,
                    409,
                    "CHALLAN_STOCK_MOVED",
                );
            }

            const added = await this._repository.findInventoryAdded(tx, id);
            for (const [colorVariantId, rows] of Object.entries(Object.groupBy(added, (row) => row.color_variant_id))) {
                const delta = new Map(rows.map((row) => [row.design_size_id, row.quantity]));
                const inventory = await this._variantInventoryRepository.findByColorVariantId(tx, Number(colorVariantId));
                const onHand = new Map(inventory.map((row) => [row.designSizeId, row.quantity]));
                for (const [designSizeId, quantity] of delta) {
                    if ((onHand.get(designSizeId) ?? 0) < quantity) {
                        throw new ApiError("Part of this challan's stock has already been sold, so it can't be dropped.", 409, "CHALLAN_STOCK_MOVED");
                    }
                }
                await this._variantInventoryRepository.upsertIncrement(tx, this._variantInventoryRepository.buildDecrementRows(Number(colorVariantId), delta));

                await this._stockHistoryService.record(tx, "STOCK_ADJUSTED_OUT", {
                    colorVariantId: Number(colorVariantId),
                    quantity: [...delta.values()].reduce((sum, q) => sum + q, 0),
                    metadata: {
                        reason: "Challan dropped",
                        note: reason,
                        challanId: id,
                        challanSerial: formatSerial(challan.serial),
                        sizeBreakdown: [...delta.entries()].map(([designSizeId, quantity]) => ({ designSizeId, quantity })),
                    },
                });
            }

            await this._stockItemRepository.markConsumed(tx, items.map((item) => item.id));
            await this._stockItemQrRepository.retireByIds(tx, await this._repository.findActiveQrIds(tx, id), { retiredReason: "CHALLAN_DROPPED" });

            await this._repository.update(tx, id, { status: "DROPPED", voidReason: reason, voidedAt: new Date() });
            await this._repository.addEvent(tx, { challanId: id, kind: "DROP", note: reason, actor: DEFAULT_ACTOR });
        });

        return this.getById(id);
    }

    async logEvent(id, { kind }) {
        const challan = await this._repository.findById(db, id);
        if (!challan) throw new ApiError("Challan not found.", 404, "NOT_FOUND");
        await this._repository.addEvent(db, { challanId: id, kind, actor: DEFAULT_ACTOR });
        return { id };
    }
}

export default new StockInChallanService();
