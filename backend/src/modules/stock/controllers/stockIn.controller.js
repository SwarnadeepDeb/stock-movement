import { ApiResponse } from "../../../core/apiResponse.js";
import stockInService from "../services/stockIn.service.js";

class StockInController {
    _stockInService = stockInService;

    registerStockIn = async (req, res, next) => {
        try {
            const result = await this._stockInService.registerStockIn(req.body);
            return res.status(201).json(new ApiResponse(201, result, "Stock registered successfully."));
        } catch (error) {
            next(error);
        }
    };

    getSerialCounters = async (req, res, next) => {
        try {
            const result = await this._stockInService.getSerialCounters(req.validatedQuery.colorVariantIds);
            return res.status(200).json(new ApiResponse(200, result, "Serial counters fetched successfully."));
        } catch (error) {
            next(error);
        }
    };
}

export default new StockInController();
