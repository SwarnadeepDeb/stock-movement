import { useQuery } from "@tanstack/react-query";
import { getItemNamesApi } from "../services/design.api.js";

// Keyed under "designs" so registering/updating a design (which invalidates ["designs"])
// refetches this list — a newly typed item name then shows up as a dropdown option.
export function useItemNamesApi() {
    return useQuery({
        queryKey: ["designs", "item-names"],
        queryFn: getItemNamesApi,
        staleTime: 5 * 60 * 1000,
    });
}
