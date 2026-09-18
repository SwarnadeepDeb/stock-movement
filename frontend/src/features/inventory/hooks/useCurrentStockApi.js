import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getCurrentStockApi } from "../services/currentStock.api.js";

export function useCurrentStockApi({ page = 1, limit = 20, keyword } = {}) {
    return useQuery({
        queryKey: ["current-stock", { page, limit, keyword }],
        queryFn: () => getCurrentStockApi({ page, limit, keyword }),
        placeholderData: keepPreviousData,
    });
}
