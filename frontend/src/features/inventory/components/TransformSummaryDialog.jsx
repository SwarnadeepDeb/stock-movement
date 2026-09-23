import { useState } from "react";

import ActionModal from "@/components/shared/ActionModal";
import { Button } from "@/components/ui/button";

// Confirmation summary shown before an irreversible loose-pieces transformation commits — same
// "confirm before an important stock mutation" pattern as AddBundleDialog, rendered through
// ModalProvider (useModal) rather than page-local state. Shared by both LOOSE_TO_SET and
// LOOSE_TO_BUNDLE — `unitLabel`/`bundleName` are the only things that differ between them.
const TransformSummaryDialog = ({
  design,
  variant,
  unitLabel,
  bundleName,
  quantityToCreate,
  rows,
  isSubmitting,
  onConfirm,
  onClose,
}) => {
  const [open, setOpen] = useState(true);

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    if (!nextOpen) setTimeout(onClose, 150);
  };

  const handleConfirm = async () => {
    const succeeded = await onConfirm();
    if (succeeded) handleOpenChange(false);
  };

  return (
    <ActionModal
      openActionModal={open}
      setOpenActionModal={handleOpenChange}
      title={`Transform Loose Pieces → ${unitLabel}s`}
      locked={isSubmitting}
    >
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Design</span>
          <span className="font-medium text-foreground">
            {design.code ? `${design.code} · ` : ""}
            {design.name}
          </span>
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Variant</span>
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <span
              className="size-2.5 shrink-0 rounded-full border border-black/10"
              style={{ backgroundColor: variant.colorHex }}
            />
            {variant.colorName}
          </span>
        </div>

        {bundleName && (
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Bundle</span>
            <span className="font-medium text-foreground">{bundleName}</span>
          </div>
        )}

        <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
          <span className="text-sm font-medium text-foreground">{unitLabel}s to Create</span>
          <span className="text-lg font-bold text-[#1E1B4B] tabular-nums">{quantityToCreate}</span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Pieces to Consume / Remaining</span>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Size</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Consume</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.designSizeId} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-foreground">{row.size}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">{row.consume}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{row.remaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-1 flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="button" className="h-11 flex-1 bg-[#00694C]" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Transforming..." : `Transform to ${unitLabel}s`}
          </Button>
        </div>
      </div>
    </ActionModal>
  );
};

export default TransformSummaryDialog;
