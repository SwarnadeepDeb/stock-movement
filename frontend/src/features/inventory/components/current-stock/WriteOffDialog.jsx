import { useState } from "react";
import { toast } from "react-toastify";
import { Loader2 } from "lucide-react";

import ActionModal from "@/components/shared/ActionModal";
import { Button } from "@/components/ui/button";
import { useWriteOffStockApi } from "../../hooks/useCurrentStockOverviewApi";
import { adjustmentCode, variantLabel, WRITE_OFF_REASONS } from "../../utils/currentStock";
import { DialogFooter, Field, FIELD_INPUT, Preview } from "./formControls";

// Confirms a write-off of whatever is selected in the drawer: whole tagged units (sets, semi
// sets, tagged pieces) plus a quantity of untagged loose pieces per size.
const WriteOffDialog = ({ variant, selection, onClose, onDone }) => {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const { mutateAsync: writeOff, isPending } = useWriteOffStockApi();

  const { stockItemIds, loosePieces, pieceCount, sizeSummary } = selection;

  const handleSubmit = async () => {
    if (!reason) {
      toast.error("Choose a reason.");
      return;
    }
    try {
      const result = await writeOff({
        colorVariantId: variant.colorVariantId,
        stockItemIds,
        loosePieces,
        reason,
        note: note.trim() || undefined,
      });
      toast.success(`Wrote off ${result.data.quantity} pcs · ${adjustmentCode(result.data.id)}`);
      onDone();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <ActionModal
      openActionModal
      setOpenActionModal={(open) => !open && onClose()}
      locked={isPending}
      title={`Write off ${pieceCount} piece${pieceCount === 1 ? "" : "s"}`}
      className="max-w-xl sm:max-w-xl"
    >
      <div className="space-y-3 px-5 py-4 text-[13.3px] text-slate-700">
        <p className="m-0">
          {variantLabel(variant)} · stock goes {variant.totalPieces} → <b>{variant.totalPieces - pieceCount}</b> pcs. The pieces
          leave stock but stay in the log, so this can be reversed.
        </p>
        <Preview>
          <b>{sizeSummary}</b>
        </Preview>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Reason" required>
            <select className={FIELD_INPUT} value={reason} onChange={(event) => setReason(event.target.value)} autoFocus>
              <option value="">Choose a reason</option>
              {WRITE_OFF_REASONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </Field>
          <Field label="Note">
            <input className={FIELD_INPUT} placeholder="e.g. stain on sleeve" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
          </Field>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={isPending} className="gap-2 bg-red-600 text-white hover:bg-red-700">
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Write off {pieceCount} pc{pieceCount === 1 ? "" : "s"}
        </Button>
      </DialogFooter>
    </ActionModal>
  );
};

export default WriteOffDialog;
