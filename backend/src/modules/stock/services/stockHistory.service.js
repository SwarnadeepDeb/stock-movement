import { db } from "../../../database/index.js";
import stockHistoryRepository from "../repositories/stockHistory.repository.js";

const EVENT_TYPES = new Set(["STOCK_IN", "SET_ASSEMBLED", "BUNDLE_ASSEMBLED", "STOCK_OUT", "SET_BROKEN", "STOCK_ADJUSTED_IN", "STOCK_ADJUSTED_OUT"]);

function toHistoryView(row) {
    return {
        id: row.id,
        eventType: row.eventType,
        createdAt: row.createdAt,

        designId: row.designId,
        designCode: row.designCode,
        designName: row.designName,

        colorVariantId: row.colorVariantId,
        colorName: row.colorName,
        colorHex: row.colorHex,

        quantity: row.quantity,
        metadata: row.metadata ?? null,

        stockInTransactionId: row.stockInTransactionId,
        stockOutTransactionId: row.stockOutTransactionId,
        stockDate: row.stockDate ?? null,
        challanNo: row.challanNo ?? null,
    };
}

class StockHistoryService {
    _stockHistoryRepository = stockHistoryRepository;

    // Records one stock-history event. Only ever called from inside the same database
    // transaction as the stock mutation it describes (stockIn.service.js's
    // _registerVariantStockIn, stockItem.service.js's assembleSet/assembleBundle) — never
    // exposed through a route, so `tx` here is always a real open transaction, not `db`.
    async record(tx, eventType, { colorVariantId, stockGroupId = null, resultStockItemId = null, stockInTransactionId = null, stockOutTransactionId = null, quantity, metadata = null }) {
        if (!EVENT_TYPES.has(eventType)) {
            throw new Error(`Unknown stock history event type: ${eventType}`);
        }

        return this._stockHistoryRepository.create(tx, {
            eventType,
            colorVariantId,
            stockGroupId,
            resultStockItemId,
            stockInTransactionId,
            stockOutTransactionId,
            quantity,
            metadata,
        });
    }

    async list({ page, limit, keyword, eventType, colorVariantId, dateFrom, dateTo }) {
        const offset = (page - 1) * limit;
        const filters = { keyword, eventType, colorVariantId, dateFrom, dateTo };

        const [rows, total] = await Promise.all([
            this._stockHistoryRepository.findMany(db, { limit, offset, ...filters }),
            this._stockHistoryRepository.count(db, filters),
        ]);

        return {
            data: rows.map(toHistoryView),
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }
}

export default new StockHistoryService();
