import stockTransformationController from "../controllers/stockTransformation.controller.js";
import { validateRequest } from "../../../core/validateRequest.js";
import {
    breakSchema,
    codeParamsSchema,
    colorVariantIdParamsSchema,
    formSchema,
    moveSchema,
    transformationIdParamsSchema,
    undoSchema,
} from "../validators/stockTransformation.validator.js";

export const stockTransformationRoutes = [
    { path: "/overview", controller: { get: stockTransformationController.getOverview } },
    { path: "/log", controller: { get: stockTransformationController.getLog } },
    {
        path: "/journey/:code",
        controller: { get: stockTransformationController.getJourney },
        validators: { get: validateRequest(codeParamsSchema, "params") },
    },
    {
        path: "/variants/:colorVariantId/pool",
        controller: { get: stockTransformationController.getVariantPool },
        validators: { get: validateRequest(colorVariantIdParamsSchema, "params") },
    },
    {
        path: "/units/:code",
        controller: { get: stockTransformationController.resolveUnit },
        validators: { get: validateRequest(codeParamsSchema, "params") },
    },
    {
        path: "/pieces/:code",
        controller: { get: stockTransformationController.resolvePiece },
        validators: { get: validateRequest(codeParamsSchema, "params") },
    },
    {
        path: "/break",
        controller: { post: stockTransformationController.breakUnit },
        validators: { post: validateRequest(breakSchema) },
    },
    {
        path: "/form",
        controller: { post: stockTransformationController.formUnit },
        validators: { post: validateRequest(formSchema) },
    },
    {
        path: "/move",
        controller: { post: stockTransformationController.movePieces },
        validators: { post: validateRequest(moveSchema) },
    },
    {
        path: "/:id/undo",
        controller: { post: stockTransformationController.undo },
        validators: { post: [validateRequest(transformationIdParamsSchema, "params"), validateRequest(undoSchema)] },
    },
];
