import { useFieldArray } from "react-hook-form";
import { ImageIcon, Plus, RefreshCw } from "lucide-react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { useModal } from "@/components/shared/ModalProvider";
import VariantModal from "./VariantModal";

// Variants step while editing: every variant is editable in place — name, colour, photo — and new
// ones are added through the same modal as registration. A variant that still has stock can't be
// removed (the server refuses too); the card says why.
const EditableVariants = ({ control }) => {
  const { openModal } = useModal();
  const { fields, append, remove, update } = useFieldArray({ control, name: "colorVariants", keyName: "fieldKey" });

  const handleAdd = () =>
    openModal(VariantModal, {
      onAdd: (variant) => {
        const taken = fields.some((field) => field.colorName.trim().toLowerCase() === variant.colorName.trim().toLowerCase());
        if (taken) {
          toast.error(`"${variant.colorName}" is already a variant of this design.`);
          return;
        }
        append({ ...variant, piecesInStock: 0 });
      },
    });

  const replacePhoto = (index, file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    update(index, { ...fields[index], imageFile: file, imagePreview: URL.createObjectURL(file) });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Color Variants</h3>
        <Button type="button" onClick={handleAdd} className="gap-1.5 rounded-full bg-emerald-600 px-4 text-white hover:bg-emerald-700">
          <Plus className="size-4" /> Variant
        </Button>
      </div>

      <div className="flex flex-wrap gap-4">
        {fields.map((field, index) => (
          <div key={field.fieldKey} className="w-[190px] overflow-hidden rounded-[14px] border border-slate-200 bg-white">
            <div className="relative aspect-square w-full bg-slate-100">
              {field.imagePreview ? (
                <img src={field.imagePreview} alt={field.colorName} className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center text-slate-400">
                  <ImageIcon className="size-6" />
                </div>
              )}
              <label className="absolute bottom-2 right-2 flex cursor-pointer items-center gap-1 rounded-full bg-slate-900/60 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-900/75">
                <RefreshCw className="size-3" /> {field.imageFile && field.id ? "Photo changed" : "Replace photo"}
                <input type="file" accept="image/*" className="hidden" onChange={(event) => replacePhoto(index, event.target.files?.[0])} />
              </label>
            </div>
            <div className="px-3 pb-3 pt-2.5">
              <input
                value={field.colorName}
                onChange={(event) => update(index, { ...field, colorName: event.target.value })}
                placeholder="Variant name"
                className="mb-2 w-full border-0 border-b border-slate-200 bg-transparent pb-1.5 pt-1 text-[13.3px] font-semibold text-slate-900 outline-none focus:border-emerald-500"
              />
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={field.colorHex}
                  onChange={(event) => update(index, { ...field, colorHex: event.target.value.toUpperCase() })}
                  aria-label={`${field.colorName} colour`}
                  className="size-5 cursor-pointer rounded-full border-0 bg-transparent p-0"
                />
                <span className="font-mono text-[11.5px] text-slate-500">{field.colorHex?.toUpperCase()}</span>
                {field.id && <span className="ml-auto text-[11px] text-slate-400">{field.piecesInStock ?? 0} pcs</span>}
              </div>
            </div>
            <div className="px-3 pb-3">
              {field.piecesInStock > 0 ? (
                <p className="text-center text-[11px] leading-snug text-slate-400">Has stock — sell or write it off before removing</p>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (fields.length === 1) {
                      toast.error("A design needs at least one variant.");
                      return;
                    }
                    remove(index);
                  }}
                  className="w-full rounded-full border-red-200 text-xs text-red-600 hover:bg-red-50"
                >
                  Remove Variant
                </Button>
              )}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={handleAdd}
          className="flex aspect-[3/4] w-[190px] flex-col items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-slate-300 text-[12.8px] font-semibold text-slate-500 hover:border-emerald-600 hover:text-emerald-600"
        >
          <Plus className="size-5" /> Add another variant
        </button>
      </div>
    </div>
  );
};

export default EditableVariants;
