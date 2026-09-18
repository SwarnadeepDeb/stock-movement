import { useQuery } from "@tanstack/react-query";
import { searchDesignsApi } from "../../design/services/design.api.js";

export const MIN_DESIGN_SEARCH_LENGTH = 2;

export function useDesignSearchApi({ keyword }) {
    const trimmedKeyword = keyword?.trim() ?? "";

    return useQuery({
        queryKey: ["designs", "search", { keyword: trimmedKeyword }],
        queryFn: () => searchDesignsApi(trimmedKeyword),
        enabled: trimmedKeyword.length >= MIN_DESIGN_SEARCH_LENGTH,
    });
}
