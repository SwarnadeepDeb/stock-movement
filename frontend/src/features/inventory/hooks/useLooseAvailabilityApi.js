import { useQuery } from "@tanstack/react-query";
import { getLooseAvailabilityApi } from "../services/stockTransformation.api.js";

// Lazy by construction: `enabled` keeps this from firing until a variant is actually selected.
export function useLooseAvailabilityApi(colorVariantId) {
    return useQuery({
        queryKey: ["loose-availability", colorVariantId],
        queryFn: () => getLooseAvailabilityApi(colorVariantId),
        enabled: Boolean(colorVariantId),
    });
}
