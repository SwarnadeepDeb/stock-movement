import tagPresetController from "../controllers/tagPreset.controller.js";
import { validateRequest } from "../../../core/validateRequest.js";
import { tagPresetParamsSchema, upsertTagPresetSchema } from "../schemas/tagPreset.validator.js";

export const tagPresetRoutes = [
    {
        path: "/:designId",
        controller: { put: tagPresetController.upsert },
        validators: { put: [validateRequest(tagPresetParamsSchema, "params"), validateRequest(upsertTagPresetSchema)] },
    },
];
