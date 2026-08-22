import ApiError from "../../../core/apiError.js";
import { ApiResponse } from "../../../core/apiResponse.js";
import stockItemService from "../services/stockItem.service.js";

class StockItemController {
    _stockItemService = stockItemService;

    updateStatus = async (req, res, next) => {
        const id = Number(req.params.id);
        const { status: targetStatus } = req.body;

        try {
            if (!Number.isInteger(id) || id <= 0) {
                throw new ApiError("Invalid stock item id.", 400, "VALIDATION_ERROR");
            }

            const result = await this._stockItemService.transitionStatus(id, targetStatus);
            return res.status(200).json(new ApiResponse(200, result, "Stock item status updated."));
        } catch (error) {
            next(error);
        }
    }

    assembleSet = async (req, res, next) => {
        const { colorVariantId, quantity } = req.body;

        try {
            const result = await this._stockItemService.assembleSet(colorVariantId, quantity);

            const message = quantity === 1
                ? "Loose pieces assembled into a new SET."
                : `Loose pieces assembled into ${quantity} new SETs.`;
            return res.status(201).json(new ApiResponse(201, result, message));
        } catch (error) {
            next(error);
        }
    };

    getLooseAvailability = async (req, res, next) => {
        const { colorVariantId } = req.params;

        try {
            const result = await this._stockItemService.getLooseAvailability(colorVariantId);

            return res.status(200).json(new ApiResponse(200, result, "Loose piece availability fetched successfully."));
        } catch (error) {
            next(error);
        }
    };

    assembleBundle = async (req, res, next) => {
        const { colorVariantId, stockGroupId, quantity } = req.body;

        try {
            const result = await this._stockItemService.assembleBundle(colorVariantId, stockGroupId, quantity);

            const message = quantity === 1
                ? "Loose pieces assembled into a new BUNDLE."
                : `Loose pieces assembled into ${quantity} new BUNDLEs.`;
            return res.status(201).json(new ApiResponse(201, result, message));
        } catch (error) {
            next(error);
        }
    };
}

export default new StockItemController();
