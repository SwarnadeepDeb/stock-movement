import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getVariantKey } from "../../utils/variantKey";
import { getVariantDisplayCode } from "../../utils/variantDisplay";
import { NO_DEFECT_CATEGORY } from "../../utils/qcDefects";

const DEFECT_CATEGORIES = [
  NO_DEFECT_CATEGORY,
  "Oil stain on collar",
  "Stitching rip on sleeve",
  "Zari thread cut",
  "Size tag mismatch",
  "Stitching unevenness",
  "Other (see remarks)",
];

const clamp = (value, max) => Math.min(Math.max(Number(value) || 0, 0), max);

// Passed + defective always equals what Set Matrix received: editing either side moves the
// other. Only the defective count and its category are stored (see StockIn.jsx's qcByKey).
const QcDefectStep = ({
  selectedVariants,
  variantTotals,
  qcByKey,
  onQcFieldChange,
  defectAction,
  onDefectActionChange,
  qcRemarks,
  onQcRemarksChange,
  errors,
}) => {
  const totalReceived = Object.values(variantTotals).reduce((sum, item) => sum + item.garmentsTotal, 0);
  const totalDefects = Object.values(qcByKey).reduce((sum, item) => sum + (Number(item.defects) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Inspection &amp; Defect Routing</h3>
          <p className="text-xs text-slate-500">
            Verify garments against stitching faults, oil stains, or sizing mismatches. Passed + defective always equals what was received.
          </p>
        </div>
        <span className="rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          Total Received: <span className="text-emerald-600">{totalReceived} Pcs</span>
        </span>
      </div>

      <div className="space-y-4">
        {selectedVariants.map((variant) => {
          const key = getVariantKey(variant);
          const expected = variantTotals[key]?.garmentsTotal ?? 0;
          const qc = qcByKey[key] ?? { passed: expected, defects: 0, category: NO_DEFECT_CATEGORY };
          const categoryError = errors[key];

          return (
            <div key={key} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-3.5 rounded-full" style={{ backgroundColor: variant.colorHex }} />
                  <span className="text-xs font-bold text-slate-900">
                    {variant.designCode ? `${variant.designCode} · ` : ""}
                    {variant.colorName} <span className="font-mono text-[11px] text-slate-400">({getVariantDisplayCode(variant)})</span>
                  </span>
                </div>
                <span className="text-xs font-medium text-slate-500">
                  Expected Inward: <strong className="text-slate-800">{expected} Pcs</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-3">
                <div>
                  <label className="mb-1 block font-medium text-slate-600" htmlFor={`passed-${key}`}>Passed (A-Grade) Pcs</label>
                  <Input
                    id={`passed-${key}`}
                    data-enter-skip
                    type="number"
                    min={0}
                    max={expected}
                    value={qc.passed}
                    onChange={(event) => onQcFieldChange(key, { defects: expected - clamp(event.target.value, expected) })}
                    className="h-[38px] rounded-lg border-slate-200 font-bold text-emerald-700 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/10"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-slate-600" htmlFor={`defects-${key}`}>Defective / Damaged Pcs</label>
                  <Input
                    id={`defects-${key}`}
                    type="number"
                    min={0}
                    max={expected}
                    value={qc.defects || ""}
                    placeholder="0"
                    onChange={(event) => onQcFieldChange(key, { defects: clamp(event.target.value, expected) })}
                    className="h-[38px] rounded-lg border-slate-200 font-bold text-red-600 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/10"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-slate-600" htmlFor={`category-${key}`}>Defect Category</label>
                  <select
                    id={`category-${key}`}
                    data-enter-skip={qc.defects > 0 ? undefined : true}
                    value={qc.category}
                    onChange={(event) => onQcFieldChange(key, { category: event.target.value })}
                    className={cn(
                      "h-[38px] w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-500/10",
                      categoryError && "border-red-500 ring-[3px] ring-red-500/10",
                    )}
                  >
                    {DEFECT_CATEGORIES.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                  {categoryError && <div className="mt-1 text-[11.5px] text-red-600">{categoryError}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
          Defect Handling Action (For {totalDefects} Damaged Pcs)
        </label>

        <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
          {[
            ["seconds", "Move to Factory Seconds / Loose (Recommended)", "Pay jobber full amount, but assign discount QR tags for warehouse clearance."],
            ["return", "Return to Jobber", "Deducts stitching payable charges for defective pieces directly from the Jobber Ledger."],
          ].map(([value, title, description]) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-start space-x-3 rounded-lg border bg-white p-3 hover:border-emerald-400",
                defectAction === value ? "border-emerald-500" : "border-slate-200",
              )}
            >
              <input
                type="radio"
                name="defectAction"
                value={value}
                checked={defectAction === value}
                onChange={() => onDefectActionChange(value)}
                className="mt-0.5 accent-emerald-600"
              />
              <div>
                <span className="block font-bold text-slate-800">{title}</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">{description}</span>
              </div>
            </label>
          ))}
        </div>

        <div className="pt-2">
          <label className="mb-1 block text-xs font-semibold text-slate-700">QC Inspection Remarks</label>
          <Textarea
            rows={2}
            placeholder="e.g. 2 pieces returned for re-stitching due to oil spot on back pleat."
            value={qcRemarks}
            onChange={(event) => onQcRemarksChange(event.target.value)}
            className="rounded-lg border-slate-200 bg-white text-xs focus-visible:border-emerald-500 focus-visible:ring-emerald-500/10"
          />
        </div>
      </div>
    </div>
  );
};

export default QcDefectStep;
