import { ApiResponse } from "../../../core/apiResponse.js";
import designDraftService from "../services/designDraft.service.js";

class DesignDraftController {
    _designDraftService = designDraftService;

    createDraft = async (req, res, next) => {
        try {
            const result = await this._designDraftService.create(req.body);
            return res.status(201).json(new ApiResponse(201, result, "Design draft saved."));
        } catch (error) {
            next(error);
        }
    };
}

export default new DesignDraftController();
