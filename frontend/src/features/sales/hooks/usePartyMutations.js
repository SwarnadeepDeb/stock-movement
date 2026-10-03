import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPartyApi, updatePartyApi, updatePartyStatusApi } from "../services/party.api.js";

function useInvalidateParties() {
    const queryClient = useQueryClient();
    return () => queryClient.invalidateQueries({ queryKey: ["parties"] });
}

export function useCreatePartyApi() {
    const invalidate = useInvalidateParties();

    return useMutation({ mutationFn: createPartyApi, onSuccess: invalidate });
}

export function useUpdatePartyApi() {
    const invalidate = useInvalidateParties();

    return useMutation({
        mutationFn: ({ id, payload }) => updatePartyApi(id, payload),
        onSuccess: invalidate,
    });
}

export function useUpdatePartyStatusApi() {
    const invalidate = useInvalidateParties();

    return useMutation({
        mutationFn: ({ id, isActive }) => updatePartyStatusApi(id, isActive),
        onSuccess: invalidate,
    });
}
