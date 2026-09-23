import { cn } from "@/lib/utils";
import { allSizeLabels, groupByDesign } from "../../utils/currentStock";
import { ColorDot, StatusPill } from "./primitives";

// Heat bands: 0 = size missing, 1–2 = nearly out, 3–10 = fine, 11+ = plenty.
const cellTone = (quantity) =>
  quantity === 0
    ? "bg-red-50 text-red-700"
    : quantity <= 2
      ? "bg-amber-100 text-amber-800"
      : quantity <= 10
        ? "bg-emerald-50 text-emerald-800"
        : "bg-emerald-200 text-emerald-900";

const TH = "sticky top-0 border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-[9.8px] font-bold uppercase tracking-[0.07em] text-slate-400";

const Legend = () => (
  <div className="mt-2.5 flex flex-wrap items-center gap-3.5 text-[11.6px] text-slate-500">
    <span><i className="mr-1.5 inline-block size-3.5 rounded bg-red-50 align-[-3px] ring-1 ring-red-200" />0 — size missing</span>
    <span><i className="mr-1.5 inline-block size-3.5 rounded bg-amber-100 align-[-3px]" />1–2 pieces</span>
    <span><i className="mr-1.5 inline-block size-3.5 rounded bg-emerald-50 align-[-3px]" />3–10</span>
    <span><i className="mr-1.5 inline-block size-3.5 rounded bg-emerald-200 align-[-3px]" />11+</span>
  </div>
);

const SizeMatrix = ({ variants }) => {
  const groups = groupByDesign(variants);
  const sizeLabels = allSizeLabels(variants);

  if (groups.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-sm text-slate-500">
        <b className="mb-1 block text-[15px] text-slate-900">Nothing matches</b>
        Try another search, or clear the filters.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-auto rounded-[13px] border border-slate-200">
        <table className="w-full border-collapse text-[12.6px]">
          <thead>
            <tr>
              <th className={cn(TH, "text-left")}>Design · variant</th>
              {sizeLabels.map((label) => (
                <th key={label} className={TH}>{label}</th>
              ))}
              <th className={TH}>Total</th>
              <th className={TH}>Status</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ design, variants: designVariants }) => [
              <tr key={`d-${design.id}`}>
                <td colSpan={sizeLabels.length + 3} className="border-b border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-900">
                  {design.code} · {design.name}
                </td>
              </tr>,
              ...designVariants.map((variant) => {
                const bySize = new Map(variant.sizes.map((size) => [size.size, size.quantity]));
                return (
                  <tr key={variant.colorVariantId}>
                    <td className="border-b border-slate-100 px-3 py-2 text-left text-slate-800">
                      <ColorDot hex={variant.colorHex} className="mr-2" />
                      {variant.colorName}
                    </td>
                    {sizeLabels.map((label) =>
                      bySize.has(label) ? (
                        <td key={label} className={cn("min-w-14 border-b border-slate-100 px-3 py-2 text-center font-mono font-bold", cellTone(bySize.get(label)))}>
                          {bySize.get(label)}
                        </td>
                      ) : (
                        <td key={label} className="border-b border-slate-100 px-3 py-2 text-center text-slate-300">n/a</td>
                      ),
                    )}
                    <td className="border-b border-slate-100 px-3 py-2 text-center font-mono font-bold text-slate-900">{variant.totalPieces}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-center">
                      <StatusPill variant={variant} />
                    </td>
                  </tr>
                );
              }),
            ])}
          </tbody>
        </table>
      </div>
      <Legend />
    </>
  );
};

export default SizeMatrix;
