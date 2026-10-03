import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { KIND } from "../utils/tagKinds.js";

export const KindChip = ({ kind }) => (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide", KIND[kind]?.tone ?? "bg-slate-100 text-slate-600")}>
        {KIND[kind]?.label ?? kind}
    </span>
);

const Pill = ({ tone, children }) => (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10.8px] font-semibold", tone)}>{children}</span>
);

const OK = "border-emerald-200 bg-emerald-50 text-emerald-700";
const BAD = "border-red-200 bg-red-50 text-red-700";
const WARN = "border-amber-200 bg-amber-50 text-amber-700";
const NEUTRAL = "border-slate-200 bg-slate-50 text-slate-600";

// What the invoice's manual box shows once a complete tag ID has been typed: the tag, what it is,
// and whether it can be added. Nothing appears for a partly typed ID, so nothing is guessed — the
// worker types what is printed on the tag and sees it confirmed here.
const TagFinderResult = ({ result, orderForm, pickedFor, onAdd }) => {
    if (!result) return null;

    if (result.state === "RETIRED" || result.state === "DUPLICATE") {
        return (
            <div className="rounded-xl border-[1.5px] border-dashed border-red-200 bg-red-50/60 px-4 py-3 text-[13px] text-red-800">
                {result.state === "RETIRED"
                    ? <><b>{result.shortCode}</b> is a retired label — its stock was broken up or relabelled. Scan the current tag.</>
                    : <><b>{result.shortCode}</b> is printed on two different items. Fix it in QR Center before billing either.</>}
            </div>
        );
    }

    if (!result.kind) return null;

    const line = orderForm?.items.find((item) => item.colorVariantId === result.colorVariantId);
    const toPick = line ? line.quantityPcs - pickedFor(result.colorVariantId) : 0;
    const disabled = result.state !== "OK";
    const sizes = result.sizeBreakdown.map((size) => size.sizeLabel).join(" ");

    let status;
    if (result.state === "ALREADY_SCANNED") status = <Pill tone={OK}><Check className="h-3 w-3" />Added</Pill>;
    else if (result.state === "UNAVAILABLE") status = <Pill tone={BAD}>{result.billedOn ? `Sold · ${result.billedOn}` : "Not in stock"}</Pill>;
    else if (!line) status = <Pill tone={WARN}>Not on order</Pill>;
    else if (toPick > 0) status = <Pill tone={OK}>On order · {toPick} to pick</Pill>;
    else status = <Pill tone={NEUTRAL}>Order line done</Pill>;

    return (
        <div className="rounded-xl border border-white/60 bg-white/40 p-1.5">
            <div className="flex justify-between px-1.5 pb-1.5 pt-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#1E1B4B]/45">
                <span>Tag found</span>
                <span>{disabled ? "" : "Press Enter or click to add"}</span>
            </div>

            <button
                type="button"
                disabled={disabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onAdd(result)}
                className={cn(
                    "grid w-full grid-cols-[50px_minmax(0,1fr)_28px] items-center gap-2.5 rounded-lg border-[1.5px] px-2.5 py-2 text-left",
                    disabled ? "cursor-not-allowed border-transparent opacity-80" : "border-emerald-500 bg-white shadow-sm",
                )}
            >
                <span className="text-center"><KindChip kind={result.kind} /></span>
                <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                        <b className="truncate font-mono text-[13.5px] text-[#1E1B4B]">{result.shortCode}</b>
                        {status}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 text-[11.8px] text-[#1E1B4B]/55">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: result.colorHex }} />
                        {result.designCode} · {result.colorName} · <span className="font-mono text-[11px] text-[#1E1B4B]/70">{sizes}</span> · {result.pieces} pc{result.pieces > 1 ? "s" : ""}
                    </span>
                </span>
                {disabled ? <span /> : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white"><Plus className="h-3.5 w-3.5" /></span>
                )}
            </button>
        </div>
    );
};

export default TagFinderResult;
