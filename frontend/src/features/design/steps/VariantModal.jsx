import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";

import ActionModal from "@/components/shared/ActionModal";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CustomFormField from "@/components/shared/form/CustomFormField";
import SingleFileUpload from "@/components/shared/form/fields/SingleFileUpload";
import { FormFieldType } from "@/config/FormFieldType";

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const VariantModal = ({ onAdd, onClose }) => {
    const [open, setOpen] = useState(true);

    const form = useForm({
        mode: "onChange",
        defaultValues: { colorName: "", colorHex: "#000000", image: null },
    });

    const { control, register, handleSubmit, watch, setValue, formState: { errors } } = form;

    const colorHex = watch("colorHex");

    const handleOpenChange = (nextOpen) => {
        setOpen(nextOpen);

        if (!nextOpen) {
            setTimeout(onClose, 150);
        }
    };

    const onSubmit = (data) => {
        onAdd({
            colorName: data.colorName.trim(),
            colorHex: data.colorHex.toUpperCase(),
            imageFile: data.image,
            imagePreview: URL.createObjectURL(data.image),
        });

        handleOpenChange(false);
    };

    return (
        <ActionModal
            openActionModal={open}
            setOpenActionModal={handleOpenChange}
            title="Add Variant"
            subtitle=""
        >
            <FormProvider {...form}>
                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 p-4 sm:p-6">
                    <CustomFormField
                        control={control}
                        name="colorName"
                        label="Color Name"
                        placeholder="e.g. Midnight Blue"
                        fieldType={FormFieldType.INPUT}
                        rules={{ required: "Color name is required" }}
                    />

                    <div className="space-y-1">
                        <label className="mb-2 block text-[14px] leading-4.5 font-medium text-gray-700">
                            Color
                        </label>
                        <div className="flex items-center gap-3">
                            <Popover>
                                <PopoverTrigger
                                    type="button"
                                    aria-label="Choose color"
                                    className="h-12 w-12 shrink-0 cursor-pointer rounded-lg border border-[#4C4A85] bg-transparent p-1"
                                >
                                    <span
                                        className="block h-full w-full rounded-sm"
                                        style={{ backgroundColor: HEX_COLOR_PATTERN.test(colorHex) ? colorHex : "#000000" }}
                                    />
                                </PopoverTrigger>
                                {/* Pinned to the left of the swatch, and collisionAvoidance="shift" keeps
                                    it there rather than letting it flip over to the right (which would
                                    cover the "Variant Image" dropzone/preview) — on narrow screens it
                                    slides along the left side instead, staying inside the viewport. */}
                                <PopoverContent
                                    side="left"
                                    align="start"
                                    sideOffset={12}
                                    collisionPadding={16}
                                    collisionAvoidance={{ side: "shift", align: "shift" }}
                                    className="w-auto p-3"
                                >
                                    <ColorPicker
                                        color={HEX_COLOR_PATTERN.test(colorHex) ? colorHex : "#000000"}
                                        onChange={(hex) => setValue("colorHex", hex, { shouldValidate: true })}
                                    />
                                </PopoverContent>
                            </Popover>
                            <input
                                {...register("colorHex", {
                                    required: "Color hex is required",
                                    pattern: { value: HEX_COLOR_PATTERN, message: "Enter a valid hex color like #FF0000" },
                                })}
                                placeholder="#FF0000"
                                className="h-12 w-full rounded-lg border border-[#4C4A85] bg-transparent px-3 py-2 text-sm text-gray-900 uppercase placeholder:text-muted-foreground focus-visible:border-[#4C4A85] focus-visible:ring-2 focus-visible:ring-[#9A99BE] focus-visible:outline-none"
                            />
                        </div>
                        {errors.colorHex && (
                            <p className="text-sm text-[#EA6365] animate-pulse">{errors.colorHex.message}</p>
                        )}
                    </div>

                    <SingleFileUpload
                        control={control}
                        name="image"
                        label="Variant Image"
                        accept={{ "image/*": [] }}
                        required
                        onColorPick={(hex) => setValue("colorHex", hex, { shouldValidate: true })}
                    />

                    <Button
                        type="submit"
                        className="mt-2 flex w-full items-center justify-center rounded-full bg-[#00694C] p-6 font-medium hover:bg-[#00694C]/90"
                    >
                        Add Variant
                    </Button>
                </form>
            </FormProvider>
        </ActionModal>
    );
};

export default VariantModal;
