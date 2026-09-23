import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import ActionModal from "@/components/shared/ActionModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDropStockInChallanApi } from "../../../hooks/useStockInChallansApi";

// Takes a whole challan back out of stock. The server refuses once any piece has been sold or
// moved and says so — that message is shown as-is.
const DropChallanDialog = ({ challan, nextSerial, onClose }) => {
  const { mutateAsync: dropChallan, isPending } = useDropStockInChallanApi();
  const [reason, setReason] = useState("");

  const handleDrop = async () => {
    if (!reason.trim()) return toast.error("Add a reason.");
    try {
      await dropChallan({ id: challan.id, reason });
      toast.success(`Challan ${challan.challanNo} dropped — ${challan.totalPieces} pcs removed from stock · ${challan.serialLabel} retired.`);
      onClose();
    } catch (error) {
      toast.error(error?.message ?? "Couldn't drop the challan.");
    }
  };

  return (
    <ActionModal
      openActionModal
      setOpenActionModal={(open) => !open && !isPending && onClose()}
      locked={isPending}
      title={`Drop challan ${challan.challanNo}?`}
    >
      <div className="space-y-4 p-4 text-sm text-slate-700 sm:p-6">
        <p>
          Sr. no. <b className="font-mono">{challan.serialLabel}</b> · challan <b className="font-mono">{challan.challanNo}</b> from{" "}
          <b>{challan.jobberName ?? "—"}</b> · {challan.totalPieces} pcs.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-[13px]">
          <li>All <b>{challan.totalPieces} pieces</b> are removed from stock.</li>
          <li>Their QR tags are retired in QR Center — take any printed tags off the garments.</li>
          <li>
            Serial no. <b className="font-mono">{challan.serialLabel}</b> is retired with it and <b>never reused</b>
            {nextSerial ? <> — the next stock-in still gets <b className="font-mono">{nextSerial}</b></> : null}.
          </li>
          <li>The challan stays in the register as <b>Dropped</b>, for the record.</li>
        </ul>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">Reason *</label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. entered twice by mistake" className="h-[42px] rounded-lg" autoFocus />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={isPending} onClick={handleDrop} className="gap-2 bg-red-600 text-white hover:bg-red-700">
            {isPending && <Loader2 className="size-4 animate-spin" />} Drop challan
          </Button>
        </div>
      </div>
    </ActionModal>
  );
};

export default DropChallanDialog;
