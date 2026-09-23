import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import ActionModal from "@/components/shared/ActionModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateStockInChallanApi } from "../../../hooks/useStockInChallansApi";
import JobberSelect from "../JobberSelect";

const FIELDS = [
  ["Jobber", "jobberName"],
  ["Jobber challan no.", "challanNo"],
  ["Inward date", "stockDate"],
  ["Issued challan no.", "issuedChallanNo"],
  ["QC remarks", "remarks"],
];

const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const Label = ({ children }) => <label className="mb-1.5 block text-xs font-semibold text-slate-700">{children}</label>;

// Corrects a challan's details. Quantities are deliberately not editable here — QR tags already
// exist for every piece; a wrong count is fixed by dropping the challan and entering it again.
const EditChallanDialog = ({ challan, onClose }) => {
  const { mutateAsync: updateChallan, isPending } = useUpdateStockInChallanApi();
  const [form, setForm] = useState({
    jobberName: challan.jobberName ?? "",
    challanNo: challan.challanNo,
    stockDate: challan.stockDate,
    issuedChallanNo: challan.issuedChallanNo ?? "",
    remarks: challan.remarks ?? "",
  });
  const [reason, setReason] = useState("");

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const changes = useMemo(
    () => FIELDS.filter(([, key]) => (challan[key] ?? "") !== form[key]).map(([label, key]) => ({ label, from: challan[key] ?? "", to: form[key] })),
    [challan, form],
  );

  const problem = !form.jobberName.trim()
    ? "Select the jobber."
    : !form.challanNo.trim()
      ? "Enter the jobber challan no."
      : !form.stockDate || form.stockDate > todayIso()
        ? "Inward date can't be empty or in the future."
        : null;

  const handleSave = async () => {
    if (problem) return toast.error(problem);
    if (changes.length === 0) return toast.info("Nothing changed.");
    if (!reason.trim()) return toast.error("Add a short reason for the edit.");
    try {
      await updateChallan({ id: challan.id, ...form, reason });
      toast.success(`Challan ${form.challanNo} updated.`);
      onClose();
    } catch (error) {
      toast.error(error?.message ?? "Couldn't update the challan.");
    }
  };

  return (
    <ActionModal
      openActionModal
      setOpenActionModal={(open) => !open && !isPending && onClose()}
      locked={isPending}
      title={`Edit challan ${challan.challanNo}`}
      subtitle="Quantities can't be edited — QR tags already exist. To fix a wrong count, drop the challan and enter it again."
    >
      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Jobber</Label>
            <JobberSelect value={form.jobberName} onChange={(item) => set("jobberName")(item?.name ?? "")} />
          </div>
          <div>
            <Label>Jobber challan no.</Label>
            <Input value={form.challanNo} onChange={(e) => set("challanNo")(e.target.value)} className="h-[42px] rounded-lg font-mono" />
          </div>
          <div>
            <Label>Inward date</Label>
            <Input type="date" max={todayIso()} value={form.stockDate} onChange={(e) => set("stockDate")(e.target.value)} className="h-[42px] rounded-lg" />
          </div>
          <div>
            <Label>Issued challan no.</Label>
            <Input value={form.issuedChallanNo} onChange={(e) => set("issuedChallanNo")(e.target.value)} className="h-[42px] rounded-lg font-mono" />
          </div>
        </div>
        <div>
          <Label>QC inspection remarks</Label>
          <Input value={form.remarks} onChange={(e) => set("remarks")(e.target.value)} className="h-[42px] rounded-lg" />
        </div>
        <div>
          <Label>Why are you editing? *</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. typo in challan number" className="h-[42px] rounded-lg" />
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          {changes.length === 0
            ? "No changes yet."
            : changes.map((change) => (
                <div key={change.label}>
                  {change.label}: <s className="text-slate-400">{change.from || "—"}</s> → <b className="text-slate-900">{change.to || "—"}</b>
                </div>
              ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={isPending} onClick={handleSave} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
            {isPending && <Loader2 className="size-4 animate-spin" />} Save changes
          </Button>
        </div>
      </div>
    </ActionModal>
  );
};

export default EditChallanDialog;
