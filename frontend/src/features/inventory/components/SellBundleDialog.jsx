import { useMemo, useState } from "react";

import ActionModal from "@/components/shared/ActionModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import QuantityStepper from "./QuantityStepper";
import SizeQuantityGrid from "./SizeQuantityGrid";

const toCompositionRecord = (composition) =>
  Object.fromEntries(composition.map((piece) => [piece.designSizeId, piece.quantity]));

const toGridSizes = (composition) =>
  composition.map((piece) => ({ id: piece.designSizeId, sizeLabel: piece.size }));

// Same shape as Stock In's AddBundleDialog (stepper + per-size grid + total line), but the
// composition itself is never freely typed — you can only sell a bundle recipe that's already
// assembled and in stock, so it's picked from `compositions` (Current Stock Detail) and shown
// read-only. When more than one recipe exists for the variant, a picker row lets you switch
// which one this entry is for. Hands { stockGroupId, quantity, composition } back through
// onSubmit — composition is a Record<designSizeId, quantity>, same shape BundleSummary/
// stockCalculations already expect from Stock In's bundles.
const SellBundleDialog = ({ compositions, initialBundle, isEditing, onSubmit, onClose }) => {
  const [open, setOpen] = useState(true);
  const [stockGroupId, setStockGroupId] = useState(initialBundle?.stockGroupId ?? compositions[0]?.stockGroupId ?? null);
  const [quantity, setQuantity] = useState(initialBundle?.quantity ?? 1);

  const selected = useMemo(
    () => compositions.find((composition) => composition.stockGroupId === stockGroupId) ?? null,
    [compositions, stockGroupId]
  );

  const piecesPerBundle = selected?.piecesPerBundle ?? 0;
  const totalPieces = piecesPerBundle * (Number(quantity) || 0);
  const isValid = Boolean(selected) && Number(quantity) > 0;

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      setTimeout(onClose, 150);
    }
  };

  const handleSelectRecipe = (nextStockGroupId) => {
    setStockGroupId(nextStockGroupId);
    setQuantity(1);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!isValid) return;

    onSubmit({
      stockGroupId: selected.stockGroupId,
      quantity: Number(quantity),
      composition: toCompositionRecord(selected.composition),
    });
    handleOpenChange(false);
  };

  return (
    <ActionModal openActionModal={open} setOpenActionModal={handleOpenChange} title={isEditing ? "Edit Bundle" : "Add Bundle"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 sm:p-6">
        {compositions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bundles currently in stock for this variant.</p>
        ) : (
          <>
            {compositions.length > 1 && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">Bundle recipe</span>
                <div className="flex flex-wrap gap-1.5">
                  {compositions.map((composition) => (
                    <button
                      key={composition.stockGroupId}
                      type="button"
                      onClick={() => handleSelectRecipe(composition.stockGroupId)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs transition-colors",
                        composition.stockGroupId === stockGroupId
                          ? "border-primary bg-primary/10"
                          : "border-border text-muted-foreground"
                      )}
                    >
                      {composition.composition.map((piece) => (
                        <span key={piece.designSizeId}>{piece.size}×{piece.quantity}</span>
                      ))}
                      <Badge variant="outline" className="ml-1">{composition.bundleCount} avl</Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Bundles Out</span>
              <QuantityStepper value={quantity} onChange={setQuantity} min={1} max={selected?.bundleCount ?? 1} />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Pieces in each bundle</span>
              {selected && <SizeQuantityGrid sizes={toGridSizes(selected.composition)} values={toCompositionRecord(selected.composition)} readOnly />}
            </div>

            <p className="text-sm text-muted-foreground">
              {piecesPerBundle} pcs / bundle · {totalPieces} pcs total
            </p>
          </>
        )}

        <div className="mt-1 flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" className="h-11 flex-1 bg-[#B91C1C]" disabled={!isValid}>
            {isEditing ? "Save Changes" : "Add Bundle"}
          </Button>
        </div>
      </form>
    </ActionModal>
  );
};

export default SellBundleDialog;
