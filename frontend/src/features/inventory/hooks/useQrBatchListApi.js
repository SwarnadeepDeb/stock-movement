import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getQrBatchesApi } from "../services/qrCenter.api.js";

// Stock-in history rows (one per challan). Shares the ["qr-center"] key prefix so every QR Center
// mutation that invalidates it refreshes this list too.
export function useQrBatchListApi({ page = 1, limit = 50, keyword, designId, colorVariantId, status, sort } = {}) {
    return useQuery({
        queryKey: ["qr-center", "batches", { page, limit, keyword, designId, colorVariantId, status, sort }],
        queryFn: () => getQrBatchesApi({ page, limit, keyword, designId, colorVariantId, status, sort }),
        placeholderData: keepPreviousData,
    });
}
