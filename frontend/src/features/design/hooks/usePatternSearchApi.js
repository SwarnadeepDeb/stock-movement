import { useQuery } from "@tanstack/react-query";
import { searchPatternsApi } from "../services/design.api.js";

export const MIN_PATTERN_SEARCH_LENGTH = 2;

export function usePatternSearchApi({ keyword }) {
    const trimmedKeyword = keyword?.trim() ?? "";

    return useQuery({
        queryKey: ["patterns", "search", { keyword: trimmedKeyword }],
        queryFn: () => searchPatternsApi(trimmedKeyword),
        enabled: trimmedKeyword.length >= MIN_PATTERN_SEARCH_LENGTH,
    });
}
