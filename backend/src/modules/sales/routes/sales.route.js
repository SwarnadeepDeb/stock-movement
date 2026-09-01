import salesController from "../controllers/sales.controller.js";
import { validateRequest } from "../../../core/validateRequest.js";
import { galleryQuerySchema, designIdParamsSchema, designSearchQuerySchema, scanQuerySchema } from "../validators/sales.validator.js";

export const salesRoutes = [
    {
        path: "/overview",
        controller: { get: salesController.getOverview },
    },
    {
        path: "/resolve-design",
        controller: { get: salesController.resolveForOrderForm },
        validators: { get: validateRequest(scanQuerySchema, "query") },
    },
    {
        path: "/design-search",
        controller: { get: salesController.searchDesigns },
        validators: { get: validateRequest(designSearchQuerySchema, "query") },
    },
    {
        path: "/designs/:designId/variants",
        controller: { get: salesController.getDesignVariants },
        validators: { get: validateRequest(designIdParamsSchema, "params") },
    },
    {
        path: "/gallery",
        controller: { get: salesController.getGallery },
        validators: { get: validateRequest(galleryQuerySchema, "query") },
    },
];
