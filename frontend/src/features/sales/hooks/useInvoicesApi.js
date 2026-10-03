import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    generateInvoiceApi,
    getInvoiceApi,
    getInvoicesApi,
    suggestInvoiceNumberApi,
    updateInvoiceApi,
} from "../services/invoice.api.js";

export function useInvoicesApi({ page = 1, limit = 100, q = "" } = {}) {
    return useQuery({
        queryKey: ["invoices", { page, limit, q }],
        queryFn: () => getInvoicesApi({ page, limit, q }),
        placeholderData: (previous) => previous,
    });
}

export function useInvoiceApi(id) {
    return useQuery({
        queryKey: ["invoices", "detail", id],
        queryFn: () => getInvoiceApi(id),
        enabled: Boolean(id),
    });
}

export function useSuggestedInvoiceNumber(enabled) {
    return useQuery({
        queryKey: ["invoices", "next-number"],
        queryFn: suggestInvoiceNumberApi,
        enabled,
        staleTime: Infinity,
    });
}

export function useSaveInvoiceApi() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, payload }) => (id ? updateInvoiceApi(id, payload) : generateInvoiceApi(payload)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
            // Generating an invoice moves stock, so anything showing stock is now stale.
            queryClient.invalidateQueries({ queryKey: ["order-forms"] });
            queryClient.invalidateQueries({ queryKey: ["sales-overview"] });
            queryClient.invalidateQueries({ queryKey: ["current-stock"] });
            queryClient.invalidateQueries({ queryKey: ["stock-history"] });
        },
    });
}
