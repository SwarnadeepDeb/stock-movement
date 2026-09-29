import { useQuery } from "@tanstack/react-query";
import { searchQualitiesApi } from "../services/design.api.js";

export const MIN_QUALITY_SEARCH_LENGTH = 2;

export function useQualitySearchApi({ keyword }) {
    const trimmedKeyword = keyword?.trim() ?? "";

    return useQuery({
        queryKey: ["qualities", "search", { keyword: trimmedKeyword }],
        queryFn: () => searchQualitiesApi(trimmedKeyword),
        enabled: trimmedKeyword.length >= MIN_QUALITY_SEARCH_LENGTH,
    });
}
