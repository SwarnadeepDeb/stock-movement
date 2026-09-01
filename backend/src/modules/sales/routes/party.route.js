import partyController from "../controllers/party.controller.js";
import { validateRequest } from "../../../core/validateRequest.js";
import {
    createPartySchema,
    listPartiesQuerySchema,
    partyIdParamsSchema,
    partyStatusSchema,
    updatePartySchema,
} from "../validators/party.validator.js";

export const partyRoutes = [
    {
        path: "",
        controller: {
            get: partyController.listParties,
            post: partyController.createParty,
        },
        validators: {
            get: validateRequest(listPartiesQuerySchema, "query"),
            post: validateRequest(createPartySchema),
        },
    },
    // Declared before "/:id" so "summary" is never parsed as an id — buildRouter registers
    // routes in array order.
    {
        path: "/summary",
        controller: {
            get: partyController.getSummary,
        },
    },
    {
        path: "/:id",
        controller: {
            get: partyController.getParty,
            put: partyController.updateParty,
        },
        validators: {
            get: validateRequest(partyIdParamsSchema, "params"),
            put: validateRequest(partyIdParamsSchema, "params"),
        },
        middlewares: {
            put: [validateRequest(updatePartySchema)],
        },
    },
    {
        path: "/:id/status",
        controller: {
            patch: partyController.updateStatus,
        },
        validators: {
            patch: validateRequest(partyIdParamsSchema, "params"),
        },
        middlewares: {
            patch: [validateRequest(partyStatusSchema)],
        },
    },
];
