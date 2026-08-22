import stockItemQrRepository from "../repositories/stockItemQr.repository.js";
import ApiError from "../../../core/apiError.js";
import { generateUniqueShortCodes } from "../utils/qrShortCode.util.js";

// PIECE is included here for stock items tagged directly by this file's caller (Stock-In's
// Parent+Child / tag-loose-pieces strategies) — every PIECE passed in has already been
// individually created for exactly this purpose, so no extra filtering condition is needed
// beyond "is this type ever meant to carry its own QR".
const QR_ELIGIBLE_TYPES = new Set(["SET", "BUNDLE", "PIECE"]);

class StockQrService {
    _stockItemQrRepository = stockItemQrRepository;

    buildPayload({ designCode, designName, colorName, stockItemId }) {
        if (!designCode) {
            throw new ApiError(
                `Design code is required to generate a QR payload for stock item ${stockItemId}.`,
                400,
                "DESIGN_CODE_REQUIRED_FOR_QR"
            );
        }

        return { designCode, designName, colorName, setId: stockItemId };
    }

    async generateForStockItems(tx, stockItems, { designCode, designName, colorName }) {
        const eligibleItems = stockItems.filter((item) => QR_ELIGIBLE_TYPES.has(item.type));
        if (eligibleItems.length === 0) return [];

        // Every ACTIVE row needs its own collision-checked shortCode (see qrShortCode.util.js),
        // distinct within this batch too — checked against the table in one query, not one per item.
        const shortCodes = await this.uniqueShortCodes(tx, eligibleItems.length);
        const rows = eligibleItems.map((item, index) => ({
            stockItemId: item.id,
            payload: this.buildPayload({ designCode, designName, colorName, stockItemId: item.id }),
            shortCode: shortCodes[index],
        }));

        return this._stockItemQrRepository.createMany(tx, rows);
    }

    uniqueShortCodes(tx, count) {
        return generateUniqueShortCodes(count, (candidates) => this._stockItemQrRepository.findActiveShortCodes(tx, candidates));
    }
}

export default new StockQrService();
