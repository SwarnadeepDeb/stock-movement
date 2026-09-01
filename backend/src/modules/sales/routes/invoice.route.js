import invoiceController from "../controllers/invoice.controller.js";
import { validateRequest } from "../../../core/validateRequest.js";
import {
    checkNumberQuerySchema,
    idParamsSchema,
    invoiceBodySchema,
    invoiceUpdateSchema,
    listQuerySchema,
    numberParamsSchema,
    scanQuerySchema,
} from "../validators/sales.validator.js";

export const invoiceRoutes = [
    {
        path: "",
        controller: {
            get: invoiceController.listInvoices,
            post: invoiceController.generateInvoice,
        },
        validators: {
            get: validateRequest(listQuerySchema, "query"),
            post: validateRequest(invoiceBodySchema),
        },
    },
    {
        path: "/check-number",
        controller: { get: invoiceController.checkNumber },
        validators: { get: validateRequest(checkNumberQuerySchema, "query") },
    },
    {
        path: "/next-number",
        controller: { get: invoiceController.suggestNumber },
    },
    // Resolves one code as it is scanned, so the picker gets an answer per scan rather than a
    // wall of errors at save time.
    {
        path: "/scan",
        controller: { get: invoiceController.checkScan },
        validators: { get: validateRequest(scanQuerySchema, "query") },
    },
    {
        path: "/by-number/:number",
        controller: { get: invoiceController.getInvoiceByNumber },
        validators: { get: validateRequest(numberParamsSchema, "params") },
    },
    {
        path: "/:id",
        controller: {
            get: invoiceController.getInvoice,
            put: invoiceController.updateInvoice,
        },
        validators: {
            get: validateRequest(idParamsSchema, "params"),
            put: validateRequest(idParamsSchema, "params"),
        },
        // Editing an invoice adjusts stock that has already been dispatched, so it belongs
        // behind a permission check — requireOwner in role.middleware.js is written and tested
        // for exactly this, and gets applied here when RBAC lands. Until then there are no
        // users to distinguish, so gating it would lock everyone out rather than protect it.
        middlewares: {
            put: [validateRequest(invoiceUpdateSchema)],
        },
    },
];
