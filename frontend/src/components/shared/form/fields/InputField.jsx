"use client";

import { useId, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const InputField = ({ name, label, placeholder, inputType, inputMode, field, format }) => {
    const { register, formState: { errors } } = useFormContext();

    const [showPassword, setShowPassword] = useState(false);

    const id = useId();

    const handleChange = (e) => {
        const rawValue = e.target.value;
        field.onChange(format ? format(rawValue) : rawValue);
    };

    return (
        <div className="space-y-1">
            <label htmlFor={id} className="block text-[14px] leading-4.5 font-medium text-gray-700 mb-2">{label}</label>
            <div className="relative">
                <Input
                    id={id}
                    type={showPassword ? "text" : inputType || "text"}
                    inputMode={inputMode}
                    // {...register(name)}
                    {...field}
                    onChange={handleChange}
                    placeholder={placeholder}
                    className="bg-transparent border border-[#4C4A85] text-gray-900 h-12 rounded-lg focus-visible:ring-2 focus-visible:ring-[#9A99BE] focus:border-[#4C4A85] w-full px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />

                {inputType === "password" && (
                    <Button
                        variant="ghost"
                        className="absolute top-1/2 -translate-y-1/2 right-3 flex items-center focus:outline-none"
                        onClick={() => setShowPassword(!showPassword)}
                        type="button"
                    >
                        {showPassword ? (
                            <EyeOff size={20} color="#76838D" />
                        ) : (
                            <Eye size={20} color="#76838D" />
                        )}
                    </Button>
                )}
            </div>

            {errors[name] && (
                <p className="text-[#EA6365] text-sm animate-pulse">
                    {errors[name]?.message}
                </p>
            )}
        </div>
    )
}

export default InputField;