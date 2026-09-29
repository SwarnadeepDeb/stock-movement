import { useFieldArray } from "react-hook-form";
import { Plus, X } from "lucide-react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Empty,
    EmptyHeader,
    EmptyTitle,
    EmptyDescription,
    EmptyContent,
} from "@/components/ui/empty";
import { useModal } from "@/components/shared/ModalProvider";
import VariantModal from "./VariantModal";
import EditableVariants from "./EditableVariants";

const Variants = (props) => (props.editDesign ? <EditableVariants control={props.control} /> : <RegisterVariants {...props} />);

const RegisterVariants = ({ control, existingDesignByCode }) => {
    const { openModal } = useModal();
    const { fields, append, remove } = useFieldArray({ control, name: "colorVariants" });

    // Design code + colour together already exist on this design — adding it here would be a
    // full duplicate the backend will reject anyway, so block it at the point of entry instead.
    const handleAddVariant = () => openModal(VariantModal, {
        onAdd: (variant) => {
            const alreadyExists = (existingDesignByCode?.colorVariants ?? []).some(
                (existing) => existing.colorName.trim().toLowerCase() === variant.colorName.trim().toLowerCase()
            );

            if (alreadyExists) {
                toast.error(`"${variant.colorName}" already exists for design code "${existingDesignByCode.code}". Choose a different colour.`);
                return;
            }

            append(variant);
        },
    });

    if (fields.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>No Variants Added Yet</EmptyTitle>
                    <EmptyDescription>
                        Add a variant available for this design.
                    </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button type="button" className="text-[#1E1B4B] p-4 neu-button rounded-full transition-colors" onClick={handleAddVariant}>
                        <Plus />
                        Variant
                    </Button>
                </EmptyContent>
            </Empty>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground">Color Variants</h3>
                <Button
                    type="button"
                    onClick={handleAddVariant}
                    className="flex items-center gap-1.5 rounded-full bg-[#00694C] p-4 font-medium text-white hover:bg-[#00694C]/90"
                >
                    <Plus className="size-4" />
                    Variant
                </Button>
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4 lg:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
                {fields.map((field, index) => (
                    <div
                        key={field.id}
                        className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
                    >
                        <button
                            type="button"
                            onClick={() => remove(index)}
                            className="absolute top-2 right-2 z-10 flex size-7 items-center justify-center rounded-full bg-white/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-destructive"
                        >
                            <X className="size-3.5" />
                        </button>

                        <div className="aspect-square w-full overflow-hidden bg-muted">
                            <img
                                src={field.imagePreview}
                                alt={field.colorName}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                        </div>

                        <div className="flex items-center justify-between gap-2 p-2.5">
                            <p className="truncate text-sm font-medium text-foreground">{field.colorName}</p>
                            <Badge variant="outline" className="gap-1.5 px-2 py-0.5">
                                <span
                                    className="size-2.5 rounded-full border border-black/10"
                                    style={{ backgroundColor: field.colorHex }}
                                />
                                <span className="text-[11px] tracking-wide text-muted-foreground uppercase">
                                    {field.colorHex}
                                </span>
                            </Badge>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Variants;
