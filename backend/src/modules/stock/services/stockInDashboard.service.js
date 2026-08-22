import { db } from "../../../database/index.js";

import stockInChallanRepository from "../repositories/stockInChallan.repository.js";
import stockInDraftRepository from "../repositories/stockInDraft.repository.js";

class StockInDashboardService {
    _stockInChallanRepository = stockInChallanRepository;
    _stockInDraftRepository = stockInDraftRepository;

    // The four numbers at the top of the Stock In page. "Batches" are challans (one per jobber
    // delivery); dropped challans never count.
    async getDashboard() {
        const [monthTotals, draftCount, pendingPrintCount] = await Promise.all([
            this._stockInChallanRepository.currentMonthTotals(db),
            this._stockInDraftRepository.count(db),
            this._stockInChallanRepository.countPendingPrint(db),
        ]);

        return {
            stats: {
                batchesThisMonth: monthTotals.batches,
                piecesThisMonth: monthTotals.pieces,
                draftsInProgress: draftCount,
                batchesPendingPrint: pendingPrintCount,
            },
        };
    }
}

export default new StockInDashboardService();
