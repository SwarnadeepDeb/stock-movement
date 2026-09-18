import { useQuery } from "@tanstack/react-query";
import { getCurrentStockDetailApi } from "../services/currentStock.api.js";

// Lazy by construction: `enabled` keeps this from firing until a colorVariantId is actually
// requested (i.e. the detail dialog is opened for a row) — the summary table never triggers it.
export function useCurrentStockDetailApi(colorVariantId) {
    return useQuery({
        queryKey: ["current-stock", colorVariantId],
        queryFn: () => getCurrentStockDetailApi(colorVariantId),
        enabled: Boolean(colorVariantId),
    });
}
