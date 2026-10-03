import { useQuery } from "@tanstack/react-query";
import { getPartiesApi } from "../services/party.api.js";

export function usePartiesApi({ page = 1, limit = 50, q = "", includeInactive = false } = {}) {
    return useQuery({
        queryKey: ["parties", { page, limit, q, includeInactive }],
        queryFn: () => getPartiesApi({ page, limit, q, includeInactive }),
        // Keeps the previous page on screen while a new search runs, so the table does not blank
        // out on every keystroke.
        placeholderData: (previous) => previous,
    });
}

