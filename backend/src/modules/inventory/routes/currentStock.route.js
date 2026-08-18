import currentStockController from "../controllers/currentStock.controller.js";
import { validateRequest } from "../../../core/validateRequest.js";
import {
    addStockSchema,
    adjustmentIdParamsSchema,
    colorVariantIdParamsSchema,
    currentStockDetailParamsSchema,
    listCurrentStockQuerySchema,
    lowStockLevelSchema,
    reverseAdjustmentSchema,
    tagCodeParamsSchema,
    writeOffSchema,
} from "../validators/currentStock.validator.js";

export const currentStockRoutes = [
    {
        path: "",
        controller: {
            get: currentStockController.getCurrentStockSummary,
        },
        validators: {
            get: validateRequest(listCurrentStockQuerySchema, "query"),
        },
    },
    // Fixed paths below MUST stay before the "/:colorVariantId" catch-all.
    {
        path: "/overview",
        controller: { get: currentStockController.getOverview },
    },
    {
        path: "/variants/:colorVariantId",
        controller: { get: currentStockController.getVariantDetail },
        validators: { get: validateRequest(colorVariantIdParamsSchema, "params") },
    },
    {
        path: "/variants/:colorVariantId/low-stock-level",
        controller: { patch: currentStockController.setLowStockLevel },
        validators: { patch: [validateRequest(colorVariantIdParamsSchema, "params"), validateRequest(lowStockLevelSchema)] },
    },
    {
        path: "/tags/:code",
        controller: { get: currentStockController.resolveTag },
        validators: { get: validateRequest(tagCodeParamsSchema, "params") },
    },
    {
        path: "/adjustments",
        controller: { get: currentStockController.listAdjustments },
    },
    {
        path: "/adjustments/add",
        controller: { post: currentStockController.addStock },
        validators: { post: validateRequest(addStockSchema) },
    },
    {
        path: "/adjustments/write-off",
        controller: { post: currentStockController.writeOff },
        validators: { post: validateRequest(writeOffSchema) },
    },
    {
        path: "/adjustments/:id/reverse",
        controller: { post: currentStockController.reverseAdjustment },
        validators: { post: [validateRequest(adjustmentIdParamsSchema, "params"), validateRequest(reverseAdjustmentSchema)] },
    },
    {
        path: "/:colorVariantId",
        controller: {
            get: currentStockController.getCurrentStockDetail,
        },
        validators: {
            get: validateRequest(currentStockDetailParamsSchema, "params"),
        },
    },
];
