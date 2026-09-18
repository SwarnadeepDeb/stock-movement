import { useQuery } from "@tanstack/react-query";
import { getActiveColorVariantSizesApi } from "../../design/services/design.api.js";

export function useColorVariantSizesApi({ colorVariantId }) {
    return useQuery({
        queryKey: ["color-variants", colorVariantId, "sizes"],
        queryFn: () => getActiveColorVariantSizesApi(colorVariantId),
        enabled: Boolean(colorVariantId),
    });
}
