import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    breakUnitApi,
    formUnitApi,
    getTagJourneyApi,
    getTransformationLogApi,
    getTransformationOverviewApi,
    getVariantPoolApi,
    movePiecesApi,
    undoTransformationApi,
} from "../services/stockTransformations.api.js";

export function useTransformationOverviewApi() {
    return useQuery({
        queryKey: ["stock-transformation", "overview"],
        queryFn: getTransformationOverviewApi,
        staleTime: 0,
    });
}

export function useTransformationLogApi({ enabled = true } = {}) {
    return useQuery({
        queryKey: ["stock-transformation", "log"],
        queryFn: getTransformationLogApi,
        enabled,
        staleTime: 0,
    });
}

export function useTagJourneyApi(tagCode) {
    return useQuery({
        queryKey: ["stock-transformation", "journey", tagCode],
        queryFn: () => getTagJourneyApi(tagCode),
        enabled: Boolean(tagCode),
        retry: false,
    });
}

export function useVariantPoolApi(colorVariantId) {
    return useQuery({
        queryKey: ["stock-transformation", "pool", colorVariantId],
        queryFn: () => getVariantPoolApi(colorVariantId),
        enabled: Boolean(colorVariantId),
        staleTime: 0,
        placeholderData: keepPreviousData,
    });
}

// Breaking, forming and moving pieces change what Current Stock counts as sets/loose pieces,
// retire or create QR tags (QR Center) and write Stock History events.
function useTransformationMutation(mutationFn) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["stock-transformation"] });
            queryClient.invalidateQueries({ queryKey: ["current-stock"] });
            queryClient.invalidateQueries({ queryKey: ["qr-center"] });
            queryClient.invalidateQueries({ queryKey: ["stock-history"] });
        },
    });
}

export const useBreakUnitApi = () => useTransformationMutation(breakUnitApi);
export const useFormUnitApi = () => useTransformationMutation(formUnitApi);
export const useMovePiecesApi = () => useTransformationMutation(movePiecesApi);
export const useUndoTransformationApi = () => useTransformationMutation(undoTransformationApi);
