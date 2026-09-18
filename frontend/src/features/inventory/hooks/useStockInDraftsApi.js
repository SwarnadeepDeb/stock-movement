import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    deleteStockInDraftApi,
    getStockInDraftApi,
    getStockInDraftsApi,
    saveStockInDraftApi,
} from "../services/stockInDraft.api.js";

export function useStockInDraftsApi() {
    return useQuery({
        queryKey: ["stock-in", "drafts"],
        queryFn: getStockInDraftsApi,
    });
}

// Always refetched on open (staleTime 0) — a draft may have been advanced in another tab.
export function useStockInDraftApi(draftId) {
    return useQuery({
        queryKey: ["stock-in", "drafts", String(draftId)],
        queryFn: () => getStockInDraftApi(draftId),
        enabled: Boolean(draftId),
        staleTime: 0,
        retry: false,
    });
}

export function useSaveStockInDraftApi() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: saveStockInDraftApi,
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ["stock-in", "dashboard"] });
            queryClient.invalidateQueries({ queryKey: ["stock-in", "drafts"], exact: true });
            if (result?.data?.id) {
                queryClient.setQueryData(["stock-in", "drafts", String(result.data.id)], result);
            }
        },
    });
}

export function useDeleteStockInDraftApi() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteStockInDraftApi,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["stock-in"] });
        },
    });
}
