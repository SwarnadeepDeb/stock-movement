import { cn } from "@/lib/utils";
import { ActionButton, Pill } from "../shared/primitives.jsx";

const PILL_TONE = { done: "ok", partial: "part", pending: "warn" };

// Below xl the row becomes a card: batch + designs full width, then sets|tags, then status|action.
const CELL_FULL = "col-span-2 xl:col-span-1";

const dmy = (isoDate) => (isoDate ? String(isoDate).slice(0, 10).split("-").reverse().join("/") : "");

function Count({ label, value, unit, note }) {
    return (
        <div>
            <span className="mr-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 xl:hidden">{label}</span>
            <span className="font-mono tabular-nums">{value} <span className="text-[11.5px] text-slate-400">{unit}</span></span>
            {note && <div className="mt-0.5 text-[11px] text-amber-700">{note}</div>}
        </div>
    );
}

// One stock-in batch (challan): every colour inwarded on it, how many tags exist and how many of
// those have been printed.
export default function HistoryRow({ row, onOpen }) {
    const tone = PILL_TONE[row.printStatus] ?? "neu";
    const label = row.printStatus === "partial"
        ? `${row.printedCount} of ${row.tagCount}`
        : row.printStatus === "done"
            ? "Fully printed"
            : "Not printed";
    const untagged = row.notTaggedCount > 0 ? `+${row.notTaggedCount} more can be tagged` : null;

    return (
        <div
            role="row"
            className={cn(
                "grid grid-cols-2 items-center gap-x-3.5 gap-y-3 border-b border-slate-200 p-3.5 text-[13.2px] text-slate-700 last:border-b-0 hover:bg-slate-50 sm:px-[18px] sm:py-4",
                "xl:grid-cols-[1.1fr_1.5fr_.65fr_.85fr_1fr_168px] xl:py-3.5",
                row.printStatus !== "done" ? "bg-amber-50/40" : "bg-white",
            )}
        >
            <div role="cell" className={CELL_FULL}>
                <div className="break-all font-mono text-[12.8px] font-semibold text-slate-900">{row.challanNo ?? row.batchId}</div>
                <div className="mt-0.5 font-mono text-[11.8px] text-slate-400">
                    {dmy(row.stockDate)}
                    {row.jobberName && <span className="font-sans"> · {row.jobberName}</span>}
                </div>
            </div>
            <div role="cell" className={cn(CELL_FULL, "space-y-1.5")}>
                {row.variants.map((variant) => (
                    <div key={variant.transactionId}>
                        <div className="leading-snug">
                            <span className="mr-1.5 inline-block size-[9px] rounded-full align-middle" style={{ backgroundColor: variant.variant.colorHex }} />
                            <b className="text-slate-900">{variant.design.code}</b> {variant.variant.colorName}
                        </div>
                        <div className="pl-4 text-[11.8px] text-slate-400">{variant.design.name}</div>
                    </div>
                ))}
            </div>
            <Count label="Sets" value={row.setCount} unit="sets" />
            <Count label="Tags" value={row.tagCount} unit="tags" note={untagged} />
            <div role="cell" className={CELL_FULL}>
                <span className="mr-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 xl:hidden">Print status</span>
                <Pill tone={tone}>{label}</Pill>
            </div>
            <div role="cell" className={cn(CELL_FULL, "xl:text-right")}>
                {row.printStatus === "done"
                    ? <ActionButton size="sm" className="w-full xl:w-auto" onClick={() => onOpen(row)}>Reprint</ActionButton>
                    : <ActionButton size="sm" variant="dark" className="w-full xl:w-auto" onClick={() => onOpen(row)}>Configure &amp; print</ActionButton>}
            </div>
        </div>
    );
}
