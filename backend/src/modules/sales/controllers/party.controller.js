import { ApiResponse } from "../../../core/apiResponse.js";
import partyService from "../services/party.service.js";

class PartyController {
    _partyService = partyService;

    createParty = async (req, res, next) => {
        try {
            const result = await this._partyService.createParty(req.body);
            return res.status(201).json(new ApiResponse(201, result, "Party added to Party Master."));
        } catch (error) {
            next(error);
        }
    };

    updateParty = async (req, res, next) => {
        try {
            const result = await this._partyService.updateParty(req.params.id, req.body);
            return res.status(200).json(new ApiResponse(200, result, "Party updated."));
        } catch (error) {
            next(error);
        }
    };

    updateStatus = async (req, res, next) => {
        try {
            const result = await this._partyService.setStatus(req.params.id, req.body.isActive);
            return res.status(200).json(new ApiResponse(200, result, "Party status updated."));
        } catch (error) {
            next(error);
        }
    };

    getParty = async (req, res, next) => {
        try {
            const result = await this._partyService.getParty(req.params.id);
            return res.status(200).json(new ApiResponse(200, result, "Party fetched successfully."));
        } catch (error) {
            next(error);
        }
    };

    listParties = async (req, res, next) => {
        try {
            const response = await this._partyService.listParties(req.validatedQuery);
            return res.status(200).json(new ApiResponse(200, response.data, "Parties fetched successfully.", response.meta));
        } catch (error) {
            next(error);
        }
    };

    getSummary = async (req, res, next) => {
        try {
            const partyCount = await this._partyService.countParties();
            return res.status(200).json(new ApiResponse(200, { partyCount }, "Summary fetched successfully."));
        } catch (error) {
            next(error);
        }
    };
}

export default new PartyController();
