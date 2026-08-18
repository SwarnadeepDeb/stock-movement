import currentStockService from "../services/currentStock.service.js";
import { ApiResponse } from "../../../core/apiResponse.js";
import currentStockOverviewService from "../services/currentStockOverview.service.js";
import stockAdjustmentService from "../../stock/services/stockAdjustment.service.js";

class CurrentStockController {
    _currentStockService = currentStockService;
    _overviewService = currentStockOverviewService;
    _adjustmentService = stockAdjustmentService;

    // Small helper so each new handler below stays one line: run, wrap in ApiResponse, forward errors.
    _respond = (statusCode, message, run) => async (req, res, next) => {
        try {
            const result = await run(req);
            return res.status(statusCode).json(new ApiResponse(statusCode, result, message));
        } catch (error) {
            next(error);
        }
    };

    getOverview = this._respond(200, "Current stock overview fetched successfully.", () => this._overviewService.getOverview());

    getVariantDetail = this._respond(200, "Variant stock fetched successfully.", (req) =>
        this._overviewService.getVariantDetail(req.params.colorVariantId));

    listAdjustments = this._respond(200, "Stock adjustments fetched successfully.", () => this._overviewService.listAdjustments());

    resolveTag = this._respond(200, "Tag resolved.", (req) => this._overviewService.resolveTag(req.params.code));

    addStock = this._respond(201, "Stock added.", (req) => this._adjustmentService.addStock(req.body));

    writeOff = this._respond(201, "Stock written off.", (req) => this._adjustmentService.writeOff(req.body));

    reverseAdjustment = this._respond(201, "Adjustment reversed.", (req) =>
        this._adjustmentService.reverse(req.params.id, req.body));

    setLowStockLevel = this._respond(200, "Low-stock level saved.", (req) =>
        this._adjustmentService.setLowStockLevel(req.params.colorVariantId, req.body.lowStockLevel));

    getCurrentStockSummary = async (req, res, next) => {
        try {
            const response = await this._currentStockService.getCurrentStockSummary(req.validatedQuery);

            return res.status(200).json(new ApiResponse(200, response.data, "Current stock fetched successfully.", response.meta));
        } catch (error) {
            next(error);
        }
    };

    getCurrentStockDetail = async (req, res, next) => {
        const { colorVariantId } = req.params;

        try {
            const response = await this._currentStockService.getCurrentStockDetail(colorVariantId);

            return res.status(200).json(new ApiResponse(200, response, "Current stock detail fetched successfully."));
        } catch (error) {
            next(error);
        }
    };
}

export default new CurrentStockController();
