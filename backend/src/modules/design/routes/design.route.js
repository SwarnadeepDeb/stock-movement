import upload from "../../../app/middlewares/multer.middleware.js";
import designController from "../controllers/design.controller.js";
import designDraftController from "../controllers/designDraft.controller.js";
import { validateRequest } from "../../../core/validateRequest.js";
import { colorVariantSizesParamsSchema, designDraftSchema, designIdParamsSchema, listDesignsQuerySchema, registerDesignSchema, updateDesignSchema, searchDesignsQuerySchema, searchJobbersQuerySchema, searchQualitiesQuerySchema, searchPatternsQuerySchema } from "../validators/design.validator.js";

// Client contract: files are sent under the repeated "images" field, and the Nth file
// corresponds to the Nth entry in colorVariants — one image per variant, in matching order.
const MAX_VARIANT_IMAGES = 20;

export const designRoutes = [
    {
        path: "/search",
        controller: {
            get: designController.searchDesign
        },
        validators: {
            get: validateRequest(searchDesignsQuerySchema, "query")
        }
    },
    {
        path: "",
        controller: {
            get: designController.getAllDesigns,
            post: designController.RegisterDesign
        },
        middlewares: {
            post: [
                upload.array("images", MAX_VARIANT_IMAGES)
            ]
        },
        validators: {
            get: validateRequest(listDesignsQuerySchema, "query"),
            post: validateRequest(registerDesignSchema)
        }
    },
    {
        path: "/jobbers",
        controller: {
            get: designController.searchJobbers
        },
        validators: {
            get: validateRequest(searchJobbersQuerySchema, "query")
        }
    },
    {
        path: "/qualities",
        controller: {
            get: designController.searchQualities
        },
        validators: {
            get: validateRequest(searchQualitiesQuerySchema, "query")
        }
    },
    {
        path: "/item-names",
        controller: {
            get: designController.getItemNames
        }
    },
    {
        path: "/patterns",
        controller: {
            get: designController.searchPatterns
        },
        validators: {
            get: validateRequest(searchPatternsQuerySchema, "query")
        }
    },
    {
        path: "/color-variants/:colorVariantId/sizes",
        controller: {
            get: designController.getActiveVariantSizes
        },
        validators: {
            get: validateRequest(colorVariantSizesParamsSchema, "params")
        }
    },
    {
        path: "/color-variants/:colorVariantId/semi-sets",
        controller: {
            get: designController.getVariantSemiSets
        },
        validators: {
            get: validateRequest(colorVariantSizesParamsSchema, "params")
        }
    },
    // Register Design wizard drafts (resumed from the Design Master dashboard).
    {
        path: "/drafts",
        controller: {
            post: designDraftController.createDraft,
        },
        validators: {
            post: validateRequest(designDraftSchema),
        },
    },
    // Must stay last: "/:id" would otherwise swallow the fixed paths above.
    {
        path: "/:id",
        controller: {
            get: designController.getDesign,
            put: designController.updateDesign,
        },
        middlewares: {
            put: [upload.array("images", MAX_VARIANT_IMAGES)],
        },
        validators: {
            get: validateRequest(designIdParamsSchema, "params"),
            put: [validateRequest(designIdParamsSchema, "params"), validateRequest(updateDesignSchema)],
        },
    },
]
