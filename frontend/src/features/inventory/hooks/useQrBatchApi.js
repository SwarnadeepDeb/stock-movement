import { useQuery } from "@tanstack/react-query";
import { getQrBatchApi } from "../services/qrCenter.api.js";

// The full tag list of one stock-in batch, for the Configure & print studio. Always refetched on
// open: tags can have been printed or created from another screen since the list was loaded.
export function useQrBatchApi(batchId, { enabled = true } = {}) {
    return useQuery({
        queryKey: ["qr-center", "batch", batchId],
        queryFn: () => getQrBatchApi(batchId),
        enabled: enabled && Boolean(batchId),
        staleTime: 0,
        gcTime: 0,
    });
}
