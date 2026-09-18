import { useQuery } from "@tanstack/react-query";
import { getStockInDashboardApi } from "../services/stockInDraft.api.js";

export function useStockInDashboardApi() {
    return useQuery({
        queryKey: ["stock-in", "dashboard"],
        queryFn: getStockInDashboardApi,
    });
}
