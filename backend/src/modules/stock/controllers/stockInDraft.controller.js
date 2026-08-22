import { ApiResponse } from "../../../core/apiResponse.js";
import stockInDraftService from "../services/stockInDraft.service.js";
import stockInDashboardService from "../services/stockInDashboard.service.js";

class StockInDraftController {
    _stockInDraftService = stockInDraftService;
    _stockInDashboardService = stockInDashboardService;

    getDashboard = async (req, res, next) => {
        try {
            const result = await this._stockInDashboardService.getDashboard();
            return res.status(200).json(new ApiResponse(200, result, "Stock In dashboard fetched successfully."));
        } catch (error) {
            next(error);
        }
    };

    listDrafts = async (req, res, next) => {
        try {
            const result = await this._stockInDraftService.list();
            return res.status(200).json(new ApiResponse(200, result, "Stock In drafts fetched successfully."));
        } catch (error) {
            next(error);
        }
    };

    getDraft = async (req, res, next) => {
        try {
            const result = await this._stockInDraftService.getById(req.params.id);
            return res.status(200).json(new ApiResponse(200, result, "Stock In draft fetched successfully."));
        } catch (error) {
            next(error);
        }
    };

    createDraft = async (req, res, next) => {
        try {
            const result = await this._stockInDraftService.create(req.body);
            return res.status(201).json(new ApiResponse(201, result, "Stock In draft saved."));
        } catch (error) {
            next(error);
        }
    };

    updateDraft = async (req, res, next) => {
        try {
            const result = await this._stockInDraftService.update(req.params.id, req.body);
            return res.status(200).json(new ApiResponse(200, result, "Stock In draft saved."));
        } catch (error) {
            next(error);
        }
    };

    deleteDraft = async (req, res, next) => {
        try {
            const result = await this._stockInDraftService.remove(req.params.id);
            return res.status(200).json(new ApiResponse(200, result, "Stock In draft discarded."));
        } catch (error) {
            next(error);
        }
    };
}

export default new StockInDraftController();
