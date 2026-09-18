import { useMutation } from "@tanstack/react-query";
import { saveTagPresetApi } from "../services/tagPreset.api.js";

export function useTagPresetApi() {
    return useMutation({
        mutationFn: saveTagPresetApi,
    });
}
