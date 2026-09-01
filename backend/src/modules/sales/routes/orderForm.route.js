import orderFormController from "../controllers/orderForm.controller.js";
import { validateRequest } from "../../../core/validateRequest.js";
import {
    checkNumberQuerySchema,
    idParamsSchema,
    listQuerySchema,
    numberParamsSchema,
    orderFormBodySchema,
} from "../validators/sales.validator.js";

export const orderFormRoutes = [
    {
        path: "",
        controller: {
            get: orderFormController.listOrderForms,
            post: orderFormController.createOrderForm,
        },
        validators: {
            get: validateRequest(listQuerySchema, "query"),
            post: validateRequest(orderFormBodySchema),
        },
    },
    // Both declared before "/:id" so neither word is ever parsed as an id.
    {
        path: "/check-number",
        controller: { get: orderFormController.checkNumber },
        validators: { get: validateRequest(checkNumberQuerySchema, "query") },
    },
    {
        path: "/next-number",
        controller: { get: orderFormController.suggestNumber },
    },
    {
        path: "/by-number/:number",
        controller: { get: orderFormController.getOrderFormByNumber },
        validators: { get: validateRequest(numberParamsSchema, "params") },
    },
    {
        path: "/:id",
        controller: {
            get: orderFormController.getOrderForm,
            put: orderFormController.updateOrderForm,
        },
        validators: {
            get: validateRequest(idParamsSchema, "params"),
            put: validateRequest(idParamsSchema, "params"),
        },
        middlewares: {
            put: [validateRequest(orderFormBodySchema)],
        },
    },
    {
        path: "/:id/cancel",
        controller: { patch: orderFormController.cancelOrderForm },
        validators: { patch: validateRequest(idParamsSchema, "params") },
    },
];
