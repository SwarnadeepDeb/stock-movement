import { useQuery } from "@tanstack/react-query";
import { getVariantSemiSetsApi } from "../../design/services/design.api.js";

export function useVariantSemiSetsApi({ colorVariantId }) {
    return useQuery({
        queryKey: ["color-variants", colorVariantId, "semi-sets"],
        queryFn: () => getVariantSemiSetsApi(colorVariantId),
        enabled: Boolean(colorVariantId),
    });
}
