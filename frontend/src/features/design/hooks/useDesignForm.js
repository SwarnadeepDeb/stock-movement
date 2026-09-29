import { useForm } from "react-hook-form";

// `defaultValues` pre-fills the wizard when editing an existing design.
export const useDesignForm = (defaultValues = {}) => {
    return useForm({
        mode: "onChange",
        defaultValues,
    });
};
