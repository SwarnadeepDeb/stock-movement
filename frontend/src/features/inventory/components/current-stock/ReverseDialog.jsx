import { useState } from "react";
import { toast } from "react-toastify";
import { Loader2 } from "lucide-react";

import ActionModal from "@/components/shared/ActionModal";
import { Button } from "@/components/ui/button";
import { useReverseStockAdjustmentApi } from "../../hooks/useCurrentStockOverviewApi";
import { adjustmentCode } from "../../utils/currentStock";
import { DialogFooter, Field, FIELD_INPUT } from "./formControls";

function describe(entry) {
  const variant = `${entry.design.code} ${entry.variant.colorName}`;
  if (entry.type === "ADD") return <>This removes the <b>{entry.quantity} pcs</b> added to {variant}.</>;
  if (entry.type === "REMOVE") return <>This puts the <b>{entry.quantity} written-off pcs</b> back into {variant}.</>;
  return <>This sets the low-stock level for {variant} back to <b>{entry.fromLevel}</b>.</>;
}

// Reverses one adjustment log entry. The server refuses (and explains why) when the pieces an ADD
// created have since been sold or written off — that message is shown as-is.
const ReverseDialog = ({ entry, onClose }) => {
  const [note, setNote] = useState("");
  const { mutateAsync: reverse, isPending } = useReverseStockAdjustmentApi();

  const handleSubmit = async () => {
    if (!note.trim()) {
      toast.error("Add a short reason.");
      return;
    }
    try {
      await reverse({ id: entry.id, note: note.trim() });
      toast.success(`${adjustmentCode(entry.id)} reversed.`);
      onClose();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <ActionModal openActionModal setOpenActionModal={(open) => !open && onClose()} locked={isPending} title={`Reverse ${adjustmentCode(entry.id)}?`}>
      <div className="space-y-3 px-5 py-4 text-[13.3px] text-slate-700">
        <p className="m-0">{describe(entry)}</p>
        <Field label="Why?" required>
          <input
            className={FIELD_INPUT}
            placeholder="e.g. entered by mistake"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleSubmit()}
            maxLength={500}
            autoFocus
          />
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={isPending} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Reverse
        </Button>
      </DialogFooter>
    </ActionModal>
  );
};

export default ReverseDialog;
