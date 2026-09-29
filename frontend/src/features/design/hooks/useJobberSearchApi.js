import { useQuery } from "@tanstack/react-query";
import { searchJobbersApi } from "../services/design.api.js";

export const MIN_JOBBER_SEARCH_LENGTH = 2;

export function useJobberSearchApi({ keyword }) {
    const trimmedKeyword = keyword?.trim() ?? "";

    return useQuery({
        queryKey: ["jobbers", "search", { keyword: trimmedKeyword }],
        queryFn: () => searchJobbersApi(trimmedKeyword),
        enabled: trimmedKeyword.length >= MIN_JOBBER_SEARCH_LENGTH,
    });
}
