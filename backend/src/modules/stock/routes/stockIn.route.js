import stockInController from "../controllers/stockIn.controller.js";
import stockInChallanController from "../controllers/stockInChallan.controller.js";
import stockInDraftController from "../controllers/stockInDraft.controller.js";
import { validateRequest } from "../../../core/validateRequest.js";
import {
    stockInChallanDropSchema,
    stockInChallanEventSchema,
    stockInChallanIdParamsSchema,
    stockInChallanListQuerySchema,
    stockInChallanUpdateSchema,
    stockInDraftIdParamsSchema,
    stockInDraftSchema,
    stockInSchema,
    stockInSerialCountersQuerySchema,
} from "../validators/stockIn.validator.js";

export const stockInRoutes = [
    {
        path: "",
        controller: {
            post: stockInController.registerStockIn,
        },
        validators: {
            post: validateRequest(stockInSchema),
        },
    },
    {
        path: "/serial-counters",
        controller: { get: stockInController.getSerialCounters },
        validators: { get: validateRequest(stockInSerialCountersQuerySchema, "query") },
    },
    {
        path: "/dashboard",
        controller: { get: stockInDraftController.getDashboard },
    },
    {
        path: "/challans",
        controller: { get: stockInChallanController.list },
        validators: { get: validateRequest(stockInChallanListQuerySchema, "query") },
    },
    // Static segments must stay above "/challans/:id".
    { path: "/challans/jobbers", controller: { get: stockInChallanController.jobberSummary } },
    { path: "/challans/next-serial", controller: { get: stockInChallanController.nextSerial } },
    {
        path: "/challans/:id",
        controller: { get: stockInChallanController.getById, patch: stockInChallanController.update },
        validators: {
            get: validateRequest(stockInChallanIdParamsSchema, "params"),
            patch: [validateRequest(stockInChallanIdParamsSchema, "params"), validateRequest(stockInChallanUpdateSchema)],
        },
    },
    {
        path: "/challans/:id/drop",
        controller: { post: stockInChallanController.drop },
        validators: { post: [validateRequest(stockInChallanIdParamsSchema, "params"), validateRequest(stockInChallanDropSchema)] },
    },
    {
        path: "/challans/:id/events",
        controller: { post: stockInChallanController.logEvent },
        validators: { post: [validateRequest(stockInChallanIdParamsSchema, "params"), validateRequest(stockInChallanEventSchema)] },
    },
    {
        path: "/drafts",
        controller: { get: stockInDraftController.listDrafts, post: stockInDraftController.createDraft },
        validators: { post: validateRequest(stockInDraftSchema) },
    },
    {
        path: "/drafts/:id",
        controller: {
            get: stockInDraftController.getDraft,
            put: stockInDraftController.updateDraft,
            delete: stockInDraftController.deleteDraft,
        },
        validators: {
            get: validateRequest(stockInDraftIdParamsSchema, "params"),
            put: [validateRequest(stockInDraftIdParamsSchema, "params"), validateRequest(stockInDraftSchema)],
            delete: validateRequest(stockInDraftIdParamsSchema, "params"),
        },
    },
];
