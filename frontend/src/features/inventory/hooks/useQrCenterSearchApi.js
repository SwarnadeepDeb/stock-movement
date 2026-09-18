import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { searchQrCenterTagsApi } from "../services/qrCenterSearch.api.js";

export function useQrCenterSearchApi(params, { enabled = true } = {}) {
    return useQuery({
        queryKey: ["qr-center-search", params],
        queryFn: () => searchQrCenterTagsApi(params),
        enabled,
        placeholderData: keepPreviousData,
    });
}
