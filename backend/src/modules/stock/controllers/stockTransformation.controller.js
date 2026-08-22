import { ApiResponse } from "../../../core/apiResponse.js";
import stockTransformationService from "../services/stockTransformation.service.js";

class StockTransformationController {
    _service = stockTransformationService;

    // Run, wrap in ApiResponse, forward errors — keeps each handler below to one line.
    _respond = (statusCode, message, run) => async (req, res, next) => {
        try {
            const result = await run(req);
            return res.status(statusCode).json(new ApiResponse(statusCode, result, message));
        } catch (error) {
            next(error);
        }
    };

    getOverview = this._respond(200, "Stock transformation overview fetched successfully.", () => this._service.getOverview());
    getLog = this._respond(200, "Transformation log fetched successfully.", () => this._service.listLog());
    getJourney = this._respond(200, "Tag journey fetched successfully.", (req) => this._service.getJourney(req.params.code));
    getVariantPool = this._respond(200, "Loose pieces fetched successfully.", (req) => this._service.getVariantPool(req.params.colorVariantId));
    resolveUnit = this._respond(200, "Set found.", (req) => this._service.resolveUnit(req.params.code));
    resolvePiece = this._respond(200, "Piece found.", (req) => this._service.resolvePiece(req.params.code));
    breakUnit = this._respond(201, "Set broken.", (req) => this._service.breakUnit(req.body));
    formUnit = this._respond(201, "Set formed.", (req) => this._service.formUnit(req.body));
    movePieces = this._respond(201, "Pieces moved.", (req) => this._service.movePieces(req.body));
    undo = this._respond(201, "Entry undone.", (req) => this._service.undo(req.params.id, req.body));
}

export default new StockTransformationController();
