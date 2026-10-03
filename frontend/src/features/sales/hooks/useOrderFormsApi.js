import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    cancelOrderFormApi,
    createOrderFormApi,
    getOrderFormApi,
    getOrderFormsApi,
    suggestOrderFormNumberApi,
    updateOrderFormApi,
} from "../services/orderForm.api.js";

export function useOrderFormsApi({ page = 1, limit = 100, q = "", status } = {}) {
    return useQuery({
        queryKey: ["order-forms", { page, limit, q, status }],
        queryFn: () => getOrderFormsApi({ page, limit, q, status }),
        placeholderData: (previous) => previous,
    });
}

export function useOrderFormApi(id) {
    return useQuery({
        queryKey: ["order-forms", "detail", id],
        queryFn: () => getOrderFormApi(id),
        enabled: Boolean(id),
    });
}

export function useSuggestedOrderFormNumber(enabled) {
    return useQuery({
        queryKey: ["order-forms", "next-number"],
        queryFn: suggestOrderFormNumberApi,
        enabled,
        // Only ever a starting point — refetching it while someone is typing would fight them.
        staleTime: Infinity,
    });
}

function useInvalidate() {
    const queryClient = useQueryClient();

    return () => {
        queryClient.invalidateQueries({ queryKey: ["order-forms"] });
        queryClient.invalidateQueries({ queryKey: ["sales-overview"] });
    };
}

export function useSaveOrderFormApi() {
    const invalidate = useInvalidate();

    return useMutation({
        mutationFn: ({ id, payload }) => (id ? updateOrderFormApi(id, payload) : createOrderFormApi(payload)),
        onSuccess: invalidate,
    });
}

export function useCancelOrderFormApi() {
    const invalidate = useInvalidate();

    return useMutation({ mutationFn: cancelOrderFormApi, onSuccess: invalidate });
}
