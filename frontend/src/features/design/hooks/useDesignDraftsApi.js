import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createDesignDraftApi } from "../services/designDraft.api.js";

export function useCreateDesignDraftApi() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createDesignDraftApi,
        // The Design Master dashboard's "Continue a draft" list must show the new draft.
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["designs", "drafts"] });
        },
    });
}
