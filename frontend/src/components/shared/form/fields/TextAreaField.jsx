import { Textarea } from "@/components/ui/textarea"
import { useId } from "react";
import { useFormContext, useWatch } from "react-hook-form";

// `maxLength` (optional) stops typing/pasting past the limit and shows a live character count.
const TextAreaField = ({ name, label, placeholder, rows = 30, disabled = false, maxLength }) => {
    const { register, control } = useFormContext();
    const value = useWatch({ control, name }) ?? "";

    const id = useId();

    return (
        <div className="space-y-1">
            {label && <label htmlFor={id} className="block text-[14px] leading-4.5 font-medium text-gray-700 mb-2">{label}</label>}
            <Textarea id={id} {...register(name)} placeholder={placeholder} rows={rows} disabled={disabled} maxLength={maxLength}
                className="bg-transparent border border-[#4C4A85] text-gray-900 h-12 rounded-lg focus-visible:ring-2 focus-visible:ring-[#9A99BE] focus:border-[#4C4A85] w-full px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
            {maxLength && (
                <p className="text-right text-xs text-gray-500">
                    {value.length}/{maxLength}
                </p>
            )}
        </div>
    )
}

export default TextAreaField
