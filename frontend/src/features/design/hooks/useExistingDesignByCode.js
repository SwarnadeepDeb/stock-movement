import { useQuery } from "@tanstack/react-query";
import { searchDesignsApi } from "../services/design.api.js";

// Looks up an exact (case-insensitive) design code match, backing the Step 1 "code already
// exists" warning and the Step 3 duplicate-colour check — reuses the existing search endpoint
// rather than adding a new one, since it already returns each design's colorVariants.
export function useExistingDesignByCode(code) {
    const trimmedCode = code?.trim() ?? "";

    return useQuery({
        queryKey: ["design-code-exists", trimmedCode.toLowerCase()],
        queryFn: async () => {
            const response = await searchDesignsApi(trimmedCode);
            const designs = response?.data ?? [];

            return designs.find((design) => design.code?.trim().toLowerCase() === trimmedCode.toLowerCase()) ?? null;
        },
        enabled: trimmedCode.length >= 2,
        staleTime: 0,
    });
}
