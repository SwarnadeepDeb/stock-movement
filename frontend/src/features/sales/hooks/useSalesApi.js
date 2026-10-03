import { useQuery } from "@tanstack/react-query";
import { getGalleryApi, getOverviewApi, searchDesignsApi } from "../services/sales.api.js";

export function useOverviewApi() {
    return useQuery({ queryKey: ["sales-overview"], queryFn: getOverviewApi });
}

export function useGalleryApi({ mode, number, q, designId, stock }, enabled = true) {
    return useQuery({
        queryKey: ["sales-gallery", { mode, number, q, designId, stock }],
        queryFn: () => getGalleryApi({ mode, number, q, designId, stock }),
        enabled,
        // A failed fetch here is usually a mistyped document number, and retrying three times
        // just delays telling the user that.
        retry: false,
    });
}

export function useDesignSearchApi(q) {
    return useQuery({
        queryKey: ["sales-design-search", q],
        queryFn: () => searchDesignsApi(q),
        // Between two keystrokes keep the previous answer on screen so the results don't flash
        // empty — but never carry the quick-pick list (empty query) over as if it were a search.
        placeholderData: (previous, previousQuery) => (q && previousQuery?.queryKey?.[1] ? previous : undefined),
        // Stock changes whenever something is billed; a minute is stale enough for a counter.
        staleTime: 15000,
    });
}
