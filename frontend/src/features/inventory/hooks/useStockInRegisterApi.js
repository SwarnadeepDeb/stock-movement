import { useMutation, useQueryClient } from "@tanstack/react-query";
import { registerStockInApi } from "../services/stockIn.api.js";

export function useStockInRegisterApi() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: registerStockInApi,
        // A confirmed inward changes the dashboard stats/recent list, removes its draft, adds
        // registrations to QR Center, and changes Current Stock.
        // The consumed draft's own detail query is skipped — refetching it would only 404.
        onSuccess: (_result, variables) => {
            const consumedDraftKey = variables?.draftId ? String(variables.draftId) : null;
            queryClient.invalidateQueries({
                queryKey: ["stock-in"],
                predicate: (query) =>
                    !(consumedDraftKey && query.queryKey[1] === "drafts" && query.queryKey[2] === consumedDraftKey),
            });
            queryClient.invalidateQueries({ queryKey: ["qr-center"] });
            queryClient.invalidateQueries({ queryKey: ["current-stock"] });
        },
    });
}
