import { computeVariantRow, aggregateRows, buildDefectNarrative } from "../../../utils/qrTagStudio";

const GenerationQueue = ({ variants, strategy, perVariantSettings, onToggleIncluded, onToggleChildTags, defectAction }) => {
  const rows = variants.map((v) => computeVariantRow(v, strategy, perVariantSettings));
  const totals = aggregateRows(rows);
  const isCustom = strategy === "custom";

  return (
    <div className="space-y-3">
      <p className="max-w-[74ch] text-[13px] text-slate-500">{buildDefectNarrative(variants, defectAction)}</p>

      <div className="overflow-x-auto rounded-[10px] border border-slate-200">
        <table className="w-full min-w-[660px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <th className="whitespace-nowrap px-3.5 py-2.5 text-left">Variant</th>
              <th className="px-3.5 py-2.5 text-right">Sets</th>
              <th className="px-3.5 py-2.5 text-right">Semi sets</th>
              <th className="px-3.5 py-2.5 text-right">Loose</th>
              <th className="px-3.5 py-2.5 text-right">Parent tags</th>
              <th className="px-3.5 py-2.5 text-right">Child tags</th>
              <th className="px-3.5 py-2.5 text-right">Loose tags</th>
              <th className="px-3.5 py-2.5 text-right">Total</th>
              {isCustom && <th className="px-3.5 py-2.5 text-center">Child?</th>}
              <th className="px-3.5 py-2.5 text-center">Include</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const settings = perVariantSettings[row.key] ?? { included: true, childTags: false };
              return (
                <tr key={row.key} className={`border-b border-slate-200 last:border-0 ${row.included ? "" : "opacity-45"}`}>
                  <td className="px-3.5 py-2.5 text-slate-600">
                    <span className="mr-2 inline-block size-[9px] rounded-full align-middle" style={{ backgroundColor: row.variant.colorHex }} />
                    <span className="font-semibold text-slate-900">{row.variant.colorName}</span>
                    <span className="ml-1.5 font-mono text-[10.5px] text-slate-400">{row.variant.code}</span>
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-slate-600">{row.variant.setsTotal}</td>
                  <td className={`px-3.5 py-2.5 text-right font-mono tabular-nums ${row.semiSets ? "text-slate-600" : "text-slate-400"}`}>
                    {row.semiSets || "—"}
                  </td>
                  <td className={`px-3.5 py-2.5 text-right font-mono tabular-nums ${row.variant.looseTotal ? "text-slate-600" : "text-slate-400"}`}>
                    {row.variant.looseTotal}
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-slate-600">{row.parentTags}</td>
                  <td className={`px-3.5 py-2.5 text-right font-mono tabular-nums ${row.child ? "text-slate-600" : "text-slate-400"}`}>
                    {row.child || "—"}
                  </td>
                  <td className={`px-3.5 py-2.5 text-right font-mono tabular-nums ${row.loose ? "text-slate-600" : "text-slate-400"}`}>
                    {row.loose || "—"}
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono font-bold tabular-nums text-slate-900">{row.total}</td>
                  {isCustom && (
                    <td className="px-3.5 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(settings.childTags)}
                        onChange={() => onToggleChildTags(row.key)}
                        disabled={!row.included}
                        className="size-4 accent-emerald-600"
                      />
                    </td>
                  )}
                  <td className="px-3.5 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => onToggleIncluded(row.key)}
                      aria-label={`Include ${row.variant.colorName}`}
                      className={`relative h-[19px] w-[34px] rounded-full transition-colors ${row.included ? "bg-emerald-500" : "bg-slate-300"}`}
                    >
                      <span
                        className={`absolute top-[2px] size-[15px] rounded-full bg-white shadow dark:bg-slate-900 transition-transform ${
                          row.included ? "translate-x-[17px]" : "translate-x-[2px]"
                        }`}
                      />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
              <td className="px-3.5 py-2.5">Batch total</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">{totals.sets}</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">{totals.semiSets || "—"}</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">{totals.loose}</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">{totals.parent}</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">{totals.child || "—"}</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">{totals.loose || "—"}</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">{totals.total}</td>
              {isCustom && <td />}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default GenerationQueue;
