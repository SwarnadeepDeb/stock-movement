import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getQrCenterListApi } from "../services/qrCenter.api.js";

export function useQrCenterListApi({ page = 1, limit = 20, keyword, designId, colorVariantId, dateFrom, dateTo, sort } = {}) {
    return useQuery({
        queryKey: ["qr-center", { page, limit, keyword, designId, colorVariantId, dateFrom, dateTo, sort }],
        queryFn: () => getQrCenterListApi({ page, limit, keyword, designId, colorVariantId, dateFrom, dateTo, sort }),
        placeholderData: keepPreviousData,
    });
}
