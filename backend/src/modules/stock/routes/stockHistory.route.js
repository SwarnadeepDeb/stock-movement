import stockHistoryController from "../controllers/stockHistory.controller.js";
import { validateRequest } from "../../../core/validateRequest.js";
import { listStockHistoryQuerySchema } from "../validators/stockHistory.validator.js";

export const stockHistoryRoutes = [
    {
        path: "",
        controller: { get: stockHistoryController.list },
        validators: { get: validateRequest(listStockHistoryQuerySchema, "query") },
    },
];
