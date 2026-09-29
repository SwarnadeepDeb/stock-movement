import { useMutation, useQueryClient } from "@tanstack/react-query";
import { registerDesignApi } from "../services/design.api.js";

export function useDesignRegisterApi() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: registerDesignApi,
        // The Design Master dashboard (and any design pickers) must show the new design.
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["designs"] });
        },
    });
}
