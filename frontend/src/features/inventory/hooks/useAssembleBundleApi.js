import { useMutation } from "@tanstack/react-query";
import { assembleBundleApi } from "../services/stockTransformation.api.js";

export function useAssembleBundleApi() {
    return useMutation({
        mutationFn: assembleBundleApi,
    });
}
