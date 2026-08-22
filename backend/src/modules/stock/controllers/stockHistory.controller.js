import stockHistoryService from "../services/stockHistory.service.js";
import { ApiResponse } from "../../../core/apiResponse.js";

// Read-only by design — history is only ever created as a side effect of real stock mutations
// (see stockIn.service.js, stockItem.service.js), never through a route.
class StockHistoryController {
    _stockHistoryService = stockHistoryService;

    list = async (req, res, next) => {
        try {
            const response = await this._stockHistoryService.list(req.validatedQuery);

            return res.status(200).json(new ApiResponse(200, response.data, "Stock history fetched successfully.", response.meta));
        } catch (error) {
            next(error);
        }
    };
}

export default new StockHistoryController();
