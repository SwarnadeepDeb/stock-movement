import { ApiResponse } from "../../../core/apiResponse.js";
import stockInChallanService from "../services/stockInChallan.service.js";

class StockInChallanController {
    _service = stockInChallanService;

    list = async (req, res, next) => {
        try {
            const result = await this._service.list(req.validatedQuery);
            return res.status(200).json(new ApiResponse(200, result, "Stock In challans fetched successfully."));
        } catch (error) {
            next(error);
        }
    };

    jobberSummary = async (req, res, next) => {
        try {
            const result = await this._service.jobberSummary();
            return res.status(200).json(new ApiResponse(200, result, "Jobber summary fetched successfully."));
        } catch (error) {
            next(error);
        }
    };

    nextSerial = async (req, res, next) => {
        try {
            const serial = await this._service.nextSerial();
            return res.status(200).json(new ApiResponse(200, { serial }, "Next serial fetched successfully."));
        } catch (error) {
            next(error);
        }
    };

    getById = async (req, res, next) => {
        try {
            const result = await this._service.getById(req.params.id);
            return res.status(200).json(new ApiResponse(200, result, "Challan fetched successfully."));
        } catch (error) {
            next(error);
        }
    };

    update = async (req, res, next) => {
        try {
            const result = await this._service.update(req.params.id, req.body);
            return res.status(200).json(new ApiResponse(200, result, "Challan updated."));
        } catch (error) {
            next(error);
        }
    };

    drop = async (req, res, next) => {
        try {
            const result = await this._service.drop(req.params.id, req.body);
            return res.status(200).json(new ApiResponse(200, result, "Challan dropped."));
        } catch (error) {
            next(error);
        }
    };

    logEvent = async (req, res, next) => {
        try {
            const result = await this._service.logEvent(req.params.id, req.body);
            return res.status(201).json(new ApiResponse(201, result, "Challan activity logged."));
        } catch (error) {
            next(error);
        }
    };
}

export default new StockInChallanController();
