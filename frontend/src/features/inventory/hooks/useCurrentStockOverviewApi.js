import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    addStockApi,
    getCurrentStockOverviewApi,
    getCurrentStockVariantApi,
    getStockAdjustmentsApi,
    reverseStockAdjustmentApi,
    setLowStockLevelApi,
    writeOffStockApi,
} from "../services/currentStockOverview.api.js";

export function useCurrentStockOverviewApi() {
    return useQuery({
        queryKey: ["current-stock", "overview"],
        queryFn: getCurrentStockOverviewApi,
    });
}

export function useCurrentStockVariantApi(colorVariantId) {
    return useQuery({
        queryKey: ["current-stock", "variant", colorVariantId],
        queryFn: () => getCurrentStockVariantApi(colorVariantId),
        enabled: Boolean(colorVariantId),
        staleTime: 0,
    });
}

export function useStockAdjustmentsApi({ enabled = true } = {}) {
    return useQuery({
        queryKey: ["current-stock", "adjustments"],
        queryFn: getStockAdjustmentsApi,
        enabled,
    });
}

// Every adjustment changes stock somewhere else in the app too — Current Stock's own views,
// Stock History's event list, QR Center (new/removed tags) and Stock Out's availability.
function useStockMutation(mutationFn) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["current-stock"] });
            queryClient.invalidateQueries({ queryKey: ["stock-history"] });
            queryClient.invalidateQueries({ queryKey: ["qr-center"] });
        },
    });
}

export const useAddStockApi = () => useStockMutation(addStockApi);
export const useWriteOffStockApi = () => useStockMutation(writeOffStockApi);
export const useReverseStockAdjustmentApi = () => useStockMutation(reverseStockAdjustmentApi);
export const useSetLowStockLevelApi = () => useStockMutation(setLowStockLevelApi);
