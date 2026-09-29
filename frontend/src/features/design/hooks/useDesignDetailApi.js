import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDesignApi, updateDesignApi } from "../services/design.api.js";

export function useDesignDetailApi(id) {
    return useQuery({
        queryKey: ["designs", "detail", String(id)],
        queryFn: () => getDesignApi(id),
        enabled: Boolean(id),
        staleTime: 0,
    });
}

// An edit can rename designs/colours, change sizes and convert sets to semi sets — every page that
// shows designs or stock needs fresh data afterwards.
export function useDesignUpdateApi() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: updateDesignApi,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["designs"] });
            queryClient.invalidateQueries({ queryKey: ["current-stock"] });
            queryClient.invalidateQueries({ queryKey: ["stock-transformation"] });
            queryClient.invalidateQueries({ queryKey: ["qr-center"] });
        },
    });
}
