import { ApiResponse } from "../../../core/apiResponse.js";
import tagPresetService from "../services/tagPreset.service.js";

class TagPresetController {
    _tagPresetService = tagPresetService;

    upsert = async (req, res, next) => {
        try {
            const result = await this._tagPresetService.upsert(req.params.designId, req.body);
            return res.status(200).json(new ApiResponse(200, result, "Tag preset saved."));
        } catch (error) {
            next(error);
        }
    };
}

export default new TagPresetController();
