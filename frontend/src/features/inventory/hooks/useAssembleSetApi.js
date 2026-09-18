import { useMutation } from "@tanstack/react-query";
import { assembleSetApi } from "../services/stockTransformation.api.js";

export function useAssembleSetApi() {
    return useMutation({
        mutationFn: assembleSetApi,
    });
}
