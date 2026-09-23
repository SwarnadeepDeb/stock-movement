import { useEffect } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { formatAge, formatInr, formatNumber, groupByDesign, sumBy } from "../../utils/currentStock";
import { formatDateOnly } from "../../utils/stockHistoryLabels";

const TH = "border-b-[1.5px] border-slate-900 px-2 py-1.5 text-left text-[9.5px] uppercase tracking-[0.06em] text-slate-600";
const TD = "border-b border-slate-200 px-2 py-2";
const N = "text-right font-mono";

// Print preview of the currently filtered Current Stock list. Rendered into <body> with the
// "cs-printing" class so the print stylesheet (index.css) prints only this sheet, and with
// .theme-light so it stays paper-coloured even while the app is in dark mode.
const PrintReport = ({ variants, asOn, isFiltered, onClose }) => {
  useEffect(() => {
    document.body.classList.add("cs-printing");
    const handleKey = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.classList.remove("cs-printing");
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const groups = groupByDesign(variants);
  const dateLabel = formatDateOnly(asOn);

  return createPortal(
    <div className="cs-print-root fixed inset-0 z-[90] flex flex-col items-center overflow-y-auto bg-slate-900/55 px-4 pb-10 pt-6" role="dialog" aria-label="Print preview">
      <div className="cs-print-bar mb-3.5 flex w-full max-w-[820px] items-center justify-between text-white">
        <span className="text-sm font-semibold">Current stock report — print preview</span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="bg-white text-slate-800">
            Close
          </Button>
          <Button type="button" size="sm" onClick={() => window.print()} className="bg-emerald-600 text-white hover:bg-emerald-700">
            Print / Save as PDF
          </Button>
        </div>
      </div>

      <div className="theme-light cs-print-sheet w-full max-w-[820px] rounded-md bg-white px-12 py-11 text-slate-900 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3.5">
          <div>
            <div className="text-xl font-bold">Current Stock Report</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {isFiltered ? "Filtered view" : "All designs"} · {variants.length} variants
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-slate-500">As on</div>
            <div className="font-mono text-base font-bold">{dateLabel}</div>
          </div>
        </div>

        <div className="my-4 grid grid-cols-3 gap-5 text-[12.5px]">
          {[
            ["Pieces", formatNumber(sumBy(variants, (variant) => variant.totalPieces))],
            ["Complete sets", sumBy(variants, (variant) => variant.sets)],
            ["Stock value", formatInr(sumBy(variants, (variant) => variant.value))],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</div>
              <div className="mt-0.5 font-semibold">{value}</div>
            </div>
          ))}
        </div>

        <table className="w-full border-collapse text-[12.3px]">
          <thead>
            <tr>
              <th className={TH}>Variant</th>
              <th className={TH}>Sizes</th>
              <th className={`${TH} text-right`}>Sets</th>
              <th className={`${TH} text-right`}>Semi</th>
              <th className={`${TH} text-right`}>Loose</th>
              <th className={`${TH} text-right`}>Pcs</th>
              <th className={`${TH} text-right`}>Value</th>
              <th className={`${TH} text-right`}>Oldest</th>
              <th className={TH}>Status</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ design, variants: designVariants }) => [
              <tr key={`d-${design.id}`}>
                <td colSpan={9} className="bg-slate-100 px-2 py-1.5 text-[11.5px] font-bold">
                  {design.code} · {design.name} · {formatInr(design.sellingPricePerPiece)}/pc
                </td>
              </tr>,
              ...designVariants.map((variant) => (
                <tr key={variant.colorVariantId}>
                  <td className={TD}>{variant.colorName}</td>
                  <td className={`${TD} font-mono text-[11px]`}>{variant.sizes.map((size) => `${size.size}:${size.quantity}`).join("  ")}</td>
                  <td className={`${TD} ${N}`}>{variant.sets}</td>
                  <td className={`${TD} ${N}`}>{variant.semiSets || "—"}</td>
                  <td className={`${TD} ${N}`}>{variant.loosePieces || "—"}</td>
                  <td className={`${TD} ${N} font-bold`}>{variant.totalPieces}</td>
                  <td className={`${TD} ${N}`}>{formatInr(variant.value)}</td>
                  <td className={`${TD} ${N}`}>{variant.totalPieces ? formatAge(variant.oldestDays) : "—"}</td>
                  <td className={TD}>{variant.status === "OUT_OF_STOCK" ? "Out" : variant.status === "LOW" ? "Low" : "OK"}</td>
                </tr>
              )),
            ])}
            <tr className="font-bold">
              <td colSpan={2} className="border-t-[1.5px] border-slate-900 px-2 py-2">Total</td>
              <td className={`border-t-[1.5px] border-slate-900 px-2 py-2 ${N}`}>{sumBy(variants, (variant) => variant.sets)}</td>
              <td className={`border-t-[1.5px] border-slate-900 px-2 py-2 ${N}`}>{sumBy(variants, (variant) => variant.semiSets)}</td>
              <td className={`border-t-[1.5px] border-slate-900 px-2 py-2 ${N}`}>{sumBy(variants, (variant) => variant.loosePieces)}</td>
              <td className={`border-t-[1.5px] border-slate-900 px-2 py-2 ${N}`}>{sumBy(variants, (variant) => variant.totalPieces)}</td>
              <td className={`border-t-[1.5px] border-slate-900 px-2 py-2 ${N}`}>{formatInr(sumBy(variants, (variant) => variant.value))}</td>
              <td className="border-t-[1.5px] border-slate-900" colSpan={2} />
            </tr>
          </tbody>
        </table>

        <div className="mt-5 flex justify-between text-[10px] text-slate-400">
          <span>Stock Mgmt · Current Stock</span>
          <span>Printed {dateLabel}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default PrintReport;
