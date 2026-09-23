import { useMemo, useState } from "react";

import ActionModal from "@/components/shared/ActionModal";
import { Button } from "@/components/ui/button";
import QuantityStepper from "./QuantityStepper";
import SizeQuantityGrid from "./SizeQuantityGrid";
import { getBundlePiecesPerBundle } from "../utils/stockCalculations";

const buildInitialComposition = (sizes, initialBundle) =>
  Object.fromEntries(sizes.map((size) => [size.id, initialBundle?.composition?.[size.id] ?? 0]));

// Owns the bundle form's temporary editing state, validation, and totals. Knows nothing
// about the Register Stock API — it only ever hands a plain { quantity, composition }
// back through onSubmit; the caller (BundleList, via useModal) decides whether that's
// an add or an update. Rendered through ModalProvider, same as VariantModal.
const AddBundleDialog = ({ sizes, initialBundle, isEditing, onSubmit, onClose }) => {
  const [open, setOpen] = useState(true);
  const [quantity, setQuantity] = useState(initialBundle?.quantity ?? 1);
  const [composition, setComposition] = useState(() => buildInitialComposition(sizes, initialBundle));

  const piecesPerBundle = useMemo(() => getBundlePiecesPerBundle(composition), [composition]);
  const totalPieces = piecesPerBundle * (Number(quantity) || 0);
  const isValid = Number(quantity) > 0 && piecesPerBundle > 0;

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      setTimeout(onClose, 150);
    }
  };

  const handleCompositionChange = (sizeId, value) => {
    setComposition((prev) => ({ ...prev, [sizeId]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!isValid) return;

    onSubmit({ quantity: Number(quantity), composition });
    handleOpenChange(false);
  };

  return (
    <ActionModal openActionModal={open} setOpenActionModal={handleOpenChange} title={isEditing ? "Edit Bundle" : "Add Bundle"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Bundles received</span>
          <QuantityStepper value={quantity} onChange={setQuantity} min={1} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Pieces in each bundle</span>
          {sizes.length > 0 ? (
            <SizeQuantityGrid sizes={sizes} values={composition} onChange={handleCompositionChange} />
          ) : (
            <p className="text-sm text-muted-foreground">No active sizes for this variant.</p>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          {piecesPerBundle} pcs / bundle · {totalPieces} pcs total
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
            {isEditing ? "Save Changes" : "Add Bundle"}
          </Button>
        </div>
      </form>
    </ActionModal>
  );
};

export default AddBundleDialog;
