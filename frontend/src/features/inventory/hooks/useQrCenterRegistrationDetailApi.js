import { useQuery } from "@tanstack/react-query";
import { getQrCenterRegistrationDetailApi } from "../services/qrCenter.api.js";

// Lazy by construction: `enabled` keeps this from firing until a registrationId is actually
// available — same pattern as useCurrentStockDetailApi. One hook for both registration types
// (Stock In and Transformation), matching the single getRegistrationDetail() on the backend.
export function useQrCenterRegistrationDetailApi({ registrationType, registrationId }) {
    return useQuery({
        queryKey: ["qr-center", "registration", registrationType, registrationId],
        queryFn: () => getQrCenterRegistrationDetailApi({ registrationType, registrationId }),
        enabled: Boolean(registrationId),
    });
}
