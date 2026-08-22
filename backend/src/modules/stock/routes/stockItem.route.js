import stockItemController from "../controllers/stockItem.controller.js";
import { validateRequest } from "../../../core/validateRequest.js";
import { assembleBundleSchema, assembleSetSchema, looseAvailabilityParamsSchema, stockItemStatusSchema } from "../validators/stockItem.validator.js";

export const stockItemRoutes = [
    {
        path: "/:id/status",
        controller: { patch: stockItemController.updateStatus },
        validators: { patch: validateRequest(stockItemStatusSchema) },
    },

    {
        path: "/loose-availability/:colorVariantId",
        controller: { get: stockItemController.getLooseAvailability },
        validators: { get: validateRequest(looseAvailabilityParamsSchema, "params") },
    },

    {
        path: "/assemble-set",
        controller: { post: stockItemController.assembleSet },
        validators: { post: validateRequest(assembleSetSchema) },
    },

    {
        path: "/assemble-bundle",
        controller: { post: stockItemController.assembleBundle },
        validators: { post: validateRequest(assembleBundleSchema) },
    },
];
