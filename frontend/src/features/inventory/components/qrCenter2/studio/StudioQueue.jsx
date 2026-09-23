import { variantQueueCounts } from "../../../utils/qrBatchStudio.js";

const NUM = "px-3.5 py-2.5 text-right font-mono tabular-nums";

// Per-colour generation queue: what the batch holds, what is already printed and how many tags
// this print would produce under the chosen strategy. A colour can be switched off for this job.
export default function StudioQueue({ variants, strategy, onToggleIncluded, narrative, printedCount, tagCount, reprintBox }) {
    const rows = variants.map((variant) => ({ variant, counts: variantQueueCounts(variant, strategy) }));
    const on = rows.filter((row) => row.counts.included);
    const sum = (pick) => on.reduce((total, row) => total + pick(row), 0);

    return (
        <div className="space-y-3">
            <p className="max-w-[74ch] text-[13px] text-slate-500">{narrative}</p>
            {reprintBox}
            <div className="overflow-x-auto rounded-[10px] border border-slate-200">
                <table className="w-full min-w-[760px] border-collapse text-[13px]">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            <th className="whitespace-nowrap px-3.5 py-2.5 text-left">Variant</th>
                            <th className="px-3.5 py-2.5 text-right">Sets</th>
                            <th className="px-3.5 py-2.5 text-right">Semi sets</th>
                            <th className="px-3.5 py-2.5 text-right">Loose</th>
                            <th className="whitespace-nowrap px-3.5 py-2.5 text-right">Printed</th>
                            <th className="whitespace-nowrap px-3.5 py-2.5 text-right">Parent tags</th>
                            <th className="whitespace-nowrap px-3.5 py-2.5 text-right">Child tags</th>
                            <th className="whitespace-nowrap px-3.5 py-2.5 text-right">Loose tags</th>
                            <th className="px-3.5 py-2.5 text-right">Total</th>
                            <th className="px-3.5 py-2.5 text-center">Include</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ variant, counts }) => (
                            <tr key={variant.transactionId} className={`border-b border-slate-200 last:border-0 ${counts.included ? "" : "opacity-45"}`}>
                                <td className="px-3.5 py-2.5 text-slate-600">
                                    <span className="mr-2 inline-block size-[9px] rounded-full align-middle" style={{ backgroundColor: variant.variant.colorHex }} />
                                    <span className="font-semibold text-slate-900">{variant.variant.colorName}</span>
                                    <span className="ml-1.5 font-mono text-[10.5px] text-slate-400">{variant.variant.code}</span>
                                </td>
                                <td className={`${NUM} text-slate-600`}>{variant.sets}</td>
                                <td className={`${NUM} ${variant.semiSets ? "text-slate-600" : "text-slate-400"}`}>{variant.semiSets || "—"}</td>
                                <td className={`${NUM} ${variant.loose ? "text-slate-600" : "text-slate-400"}`}>{variant.loose}</td>
                                <td className={`${NUM} ${counts.printed ? "text-emerald-700" : "text-slate-400"}`}>{counts.printed} / {counts.issued}</td>
                                <td className={`${NUM} text-slate-600`}>{counts.parent}</td>
                                <td className={`${NUM} ${counts.child ? "text-slate-600" : "text-slate-400"}`}>{counts.child || "—"}</td>
                                <td className={`${NUM} ${counts.loose ? "text-slate-600" : "text-slate-400"}`}>{counts.loose || "—"}</td>
                                <td className={`${NUM} font-bold text-slate-900`}>{counts.total}</td>
                                <td className="px-3.5 py-2.5 text-center">
                                    <button
                                        type="button"
                                        aria-label={`Include ${variant.variant.colorName}`}
                                        aria-pressed={counts.included}
                                        onClick={() => onToggleIncluded(variant.transactionId)}
                                        className={`relative h-[19px] w-[34px] rounded-full transition-colors ${counts.included ? "bg-emerald-500" : "bg-slate-300"}`}
                                    >
                                        <span className={`absolute top-[2px] size-[15px] rounded-full bg-white shadow transition-transform ${counts.included ? "translate-x-[17px]" : "translate-x-[2px]"}`} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
                            <td className="px-3.5 py-2.5">Batch total</td>
                            <td className={NUM}>{on.reduce((total, row) => total + row.variant.sets, 0)}</td>
                            <td className={NUM}>{on.reduce((total, row) => total + row.variant.semiSets, 0) || "—"}</td>
                            <td className={NUM}>{on.reduce((total, row) => total + row.variant.loose, 0)}</td>
                            <td className={NUM}>{printedCount} / {tagCount}</td>
                            <td className={NUM}>{sum((row) => row.counts.parent)}</td>
                            <td className={NUM}>{sum((row) => row.counts.child) || "—"}</td>
                            <td className={NUM}>{sum((row) => row.counts.loose) || "—"}</td>
                            <td className={NUM}>{sum((row) => row.counts.total)}</td>
                            <td />
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
