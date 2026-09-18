import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getStockHistoryApi } from "../services/stockHistory.api.js";

export function useStockHistoryApi({ page = 1, limit = 20, keyword, eventType, colorVariantId, dateFrom, dateTo } = {}) {
    return useQuery({
        queryKey: ["stock-history", { page, limit, keyword, eventType, colorVariantId, dateFrom, dateTo }],
        queryFn: () => getStockHistoryApi({ page, limit, keyword, eventType, colorVariantId, dateFrom, dateTo }),
        placeholderData: keepPreviousData,
    });
}
