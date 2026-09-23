import { useMemo, useState } from "react";

import ActionModal from "@/components/shared/ActionModal";
import { Button } from "@/components/ui/button";
import SizeQuantityGrid from "./SizeQuantityGrid";
import { getLoosePiecesTotal } from "../utils/stockCalculations";

const buildInitialValues = (sizes, initialLoosePieces) =>
  Object.fromEntries(sizes.map((size) => [size.id, initialLoosePieces?.[size.id] ?? 0]));

// Owns the loose-pieces form's temporary editing state, validation, and total. Knows
// nothing about the Register Stock API — it only hands a plain Record<designSizeId,
// quantity> back through onSubmit. Rendered through ModalProvider, same as VariantModal.
const AddLoosePiecesDialog = ({ sizes, initialLoosePieces, isEditing, onSubmit, onClose }) => {
  const [open, setOpen] = useState(true);
  const [values, setValues] = useState(() => buildInitialValues(sizes, initialLoosePieces));

  const total = useMemo(() => getLoosePiecesTotal(values), [values]);
  const isValid = total > 0;

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      setTimeout(onClose, 150);
    }
  };

  const handleChange = (sizeId, value) => {
    setValues((prev) => ({ ...prev, [sizeId]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!isValid) return;

    onSubmit(values);
    handleOpenChange(false);
  };

  return (
    <ActionModal openActionModal={open} setOpenActionModal={handleOpenChange} title={isEditing ? "Edit Loose Pieces" : "Loose Pieces"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 sm:p-6">
        {sizes.length > 0 ? (
          <SizeQuantityGrid sizes={sizes} values={values} onChange={handleChange} />
        ) : (
          <p className="text-sm text-muted-foreground">No active sizes for this variant.</p>
        )}

        <p className="text-sm text-muted-foreground">
          {total} loose piece{total === 1 ? "" : "s"}
        </p>

        <div className="mt-1 flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" className="h-11 flex-1 bg-[#00694C]" disabled={!isValid}>
            {isEditing ? "Save Changes" : "Add Loose Pieces"}
          </Button>
        </div>
      </form>
    </ActionModal>
  );
};

export default AddLoosePiecesDialog;
