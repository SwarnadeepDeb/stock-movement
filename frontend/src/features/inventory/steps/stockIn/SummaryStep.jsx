import { AlertCircle } from "lucide-react";

import { getVariantKey } from "../../utils/variantKey";
import { getVariantDisplayCode } from "../../utils/variantDisplay";

// The final review: what was received per variant, how QC split it, and what the inward will
// register. Counts only — no rupee values on a stock-in.
const SummaryStep = ({ selectedVariants, variantTotals, qcByKey, configs, sizeLabelsById, defectAction, challanNo, issuedChallanNo, nextSerial, tagCounts }) => {
  const rows = selectedVariants.map((variant) => {
    const key = getVariantKey(variant);
    const totals = variantTotals[key] ?? { setsTotal: 0, semiSetsTotal: 0, looseTotal: 0, garmentsTotal: 0 };
    const qc = qcByKey[key] ?? { passed: 0, defects: 0 };
    const bundles = configs[key]?.bundles ?? [];
    return { key, variant, totals, qc, bundles };
  });

  const sum = (pick) => rows.reduce((total, row) => total + pick(row), 0);
  const grandSets = sum((row) => row.totals.setsTotal);
  const grandSemi = sum((row) => row.totals.semiSetsTotal || 0);
  const grandLoose = sum((row) => row.totals.looseTotal);
  const grandPassed = sum((row) => Number(row.qc.passed) || 0);
  const grandDefects = sum((row) => Number(row.qc.defects) || 0);
  const grandReceived = sum((row) => row.totals.garmentsTotal);

  const defectLabel = defectAction === "return" ? "Returned" : "Seconds";
  const tagTotal = tagCounts.parents + tagCounts.children + tagCounts.loose;
  const tagParts = [
    tagCounts.parents ? `${tagCounts.parents} parent set QRs` : "",
    tagCounts.children ? `${tagCounts.children} child piece tags` : "",
    tagCounts.loose ? `${tagCounts.loose} loose tags` : "",
  ].filter(Boolean);

  const semiLabel = (bundles) =>
    bundles
      .filter((bundle) => bundle.quantity > 0)
      .map((bundle) => {
        const labels = Object.entries(bundle.composition ?? {})
          .filter(([, quantity]) => Number(quantity) > 0)
          .map(([sizeId]) => sizeLabelsById[sizeId])
          .filter(Boolean);
        return `${bundle.quantity} × ${labels.join("-")}`;
      })
      .join(", ");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-bold text-slate-900">Final Goods Inward Summary</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
              <tr>
                <th className="p-3">Variant Name</th>
                <th className="p-3 text-center">Full Sets Inward</th>
                <th className="p-3 text-center">Semi Sets</th>
                <th className="p-3 text-center">Loose Pcs</th>
                <th className="p-3 text-center">QC Passed</th>
                <th className="p-3 text-center">Defect / Return</th>
                <th className="p-3 text-right">Stock-in Pcs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ key, variant, totals, qc, bundles }) => (
                <tr key={key}>
                  <td className="p-3 font-semibold text-slate-800">
                    <span className="mr-2 inline-block size-2.5 rounded-full" style={{ backgroundColor: variant.colorHex }} />
                    {variant.designCode ? `${variant.designCode} · ` : ""}
                    {variant.colorName} ({getVariantDisplayCode(variant)})
                  </td>
                  <td className="p-3 text-center font-bold">{totals.setsTotal} Sets</td>
                  <td className="p-3 text-center">
                    <b>{totals.semiSetsTotal || 0} Sets</b>
                    {semiLabel(bundles) && <span className="block font-mono text-[10.5px] font-medium text-slate-500">{semiLabel(bundles)}</span>}
                  </td>
                  <td className="p-3 text-center">{totals.looseTotal} Pcs</td>
                  <td className="p-3 text-center font-semibold text-emerald-700">{qc.passed} Pcs</td>
                  <td className="p-3 text-center font-semibold text-red-600">
                    {qc.defects > 0 ? `${qc.defects} Pcs (${defectLabel})` : "0"}
                  </td>
                  <td className="p-3 text-right font-bold text-slate-900">{totals.garmentsTotal} Pcs</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50 font-bold text-slate-800">
              <tr>
                <td className="p-3">Total Inward Stock</td>
                <td className="p-3 text-center text-emerald-700">{grandSets} Sets</td>
                <td className="p-3 text-center text-emerald-700">{grandSemi} Sets</td>
                <td className="p-3 text-center text-emerald-700">{grandLoose} Pcs</td>
                <td className="p-3 text-center text-emerald-700">{grandPassed} Pcs</td>
                <td className="p-3 text-center text-red-600">{grandDefects} Pcs</td>
                <td className="p-3 text-right text-base text-slate-900">{grandReceived} Pieces</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Inward Ledger</span>
          <span className="text-xs font-semibold text-slate-500">
            Challan: {challanNo || "—"} · Issued: {issuedChallanNo || "—"} · Sr. {nextSerial ?? "…"}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-3">
          <div>
            <span className="block text-slate-500">Approved Pieces</span>
            <span className="font-mono text-[22px] font-extrabold text-emerald-700">{grandPassed}</span>
            <span className="block text-[11.5px] text-slate-500">Passed QC (A-grade)</span>
          </div>
          <div>
            <span className="block text-slate-500">Defective Pieces</span>
            <span className={`font-mono text-[22px] font-extrabold ${grandDefects ? "text-red-600" : "text-slate-900"}`}>{grandDefects}</span>
            <span className="block text-[11.5px] text-slate-500">
              {grandDefects ? (defectAction === "return" ? "Defective · returned to jobber" : "Defective · kept as factory seconds") : "No defects"}
            </span>
          </div>
          <div className="md:text-right">
            <span className="block text-slate-500">Total Received Pieces</span>
            <span className="font-mono text-[22px] font-extrabold text-slate-900">{grandReceived}</span>
            <span className="block text-[11.5px] text-slate-500">
              {grandDefects ? `${grandPassed} approved + ${grandDefects} defective` : "All approved"}
            </span>
          </div>
        </div>
      </div>

      {defectAction === "return" && grandDefects > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-slate-500" />
          <span>
            Returned pieces are recorded on the challan, but stock is registered for everything received. Once the jobber takes them back, remove them
            in Current Stock (Write off) so counts stay exact.
          </span>
        </div>
      )}
    </div>
  );
};

export default SummaryStep;
