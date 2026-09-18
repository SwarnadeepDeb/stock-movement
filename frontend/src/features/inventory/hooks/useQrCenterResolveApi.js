import { useQuery } from "@tanstack/react-query";
import { resolveQrCenterCodeApi } from "../services/qrCenter.api.js";

export function useQrCenterResolveApi(code) {
    const trimmed = (code ?? "").trim();
    return useQuery({
        queryKey: ["qr-center", "resolve", trimmed],
        queryFn: () => resolveQrCenterCodeApi(trimmed),
        enabled: trimmed.length > 0,
        staleTime: 15_000,
        retry: false,
    });
}
