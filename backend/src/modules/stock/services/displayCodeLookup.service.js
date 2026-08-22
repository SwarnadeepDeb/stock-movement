import stockItemRepository from "../repositories/stockItem.repository.js";
import { parseDisplayCode, variantCodeOf } from "../utils/qrDisplayCode.util.js";

// Reads back the readable id printed beside a QR ("SET-KP100-MID-007") for the scan stations
// that otherwise only know short codes — a worker typing what they see on the label, or a label
// whose QR was printed with that id in it, still reaches the right stock item.
class DisplayCodeLookupService {
    _stockItemRepository = stockItemRepository;

    // Every stock item the text could name: [] when it isn't a label id or matches nothing, and
    // more than one only if two colours of the same design share a 3-letter colour code.
    async findStockItemIds(runner, text) {
        const parsed = parseDisplayCode(text);
        if (!parsed) return [];

        const candidates = await this._stockItemRepository.findBySerial(runner, parsed);
        return candidates
            .filter((row) => variantCodeOf(row).toUpperCase() === parsed.variantCode)
            .map((row) => row.stockItemId);
    }
}

export default new DisplayCodeLookupService();
