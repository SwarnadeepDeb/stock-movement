import { useState } from "react";
import { Merge, MoveRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatHistoryDateParts } from "../../utils/stockHistoryLabels";
import { ColorDot, Pill } from "../current-stock/primitives";
import { SizeSlot } from "./ui";

const FILTERS = [
  ["ALL", "All"],
  ["RESTORABLE", "Restorable now"],
  ["WAITING", "Waiting on pieces"],
  ["CANT_RESTORE", "Can’t restore"],
];

const slotTone = (piece) => (piece.state === "STOCK" ? "ok" : piece.state === "OUT" ? "out" : "neutral");

// "Broken sets": where every piece of every broken set is right now, and whether the original can
// still be put back together.
const BrokenSetsTab = ({ brokenSets, onRecall, onRestore, onFormWithReplacement }) => {
  const [filter, setFilter] = useState("ALL");
  const list = brokenSets.filter((item) => filter === "ALL" || item.state === filter);

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center gap-3">
        <div className="inline-flex flex-wrap gap-0.5 rounded-[10px] border border-slate-200 bg-slate-100 p-[3px]">
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn(
                "rounded-[7px] px-3.5 py-1.5 text-[12.6px] font-semibold",
                filter === id ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.1)]" : "text-slate-500 hover:text-slate-800",
              )}
            >
              {label}
              <span className="ml-1 font-mono text-[11px] text-slate-400">{brokenSets.filter((item) => id === "ALL" || item.state === id).length}</span>
            </button>
          ))}
        </div>
        <span className="ml-auto text-[12.8px] text-slate-500">Where every piece of a broken set is right now.</span>
      </div>

      {list.length === 0 ? (
        <div className="rounded-[13px] border border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
          <b className="mb-1 block text-[15px] text-slate-900">Nothing here</b>
          {filter === "ALL" ? "No broken sets are being tracked." : "No broken sets in this group."}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((item) => {
            const gone = item.pieces.filter((piece) => piece.state === "GONE" || piece.state === "INSIDE");
            return (
              <div key={item.unit.stockItemId} className="rounded-[14px] border border-slate-200 bg-white px-4 py-3.5">
                <div className="mb-2.5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ColorDot hex={item.variant.colorHex} />
                      <b className="font-mono">{item.unit.code ?? `#${item.unit.stockItemId}`}</b>
                      <span
                        className={cn(
                          "rounded-[5px] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.04em]",
                          item.unit.kind === "SET" ? "bg-emerald-50 text-emerald-700" : "bg-violet-50 text-violet-700",
                        )}
                      >
                        {item.unit.kind === "SET" ? "SET" : "SEMI SET"}
                      </span>
                      <b>
                        {item.design.code} {item.variant.colorName}
                      </b>
                      {item.state === "RESTORABLE" ? (
                        <Pill tone="ok">All pieces back — restorable</Pill>
                      ) : item.state === "CANT_RESTORE" ? (
                        <Pill>Can’t be restored as original</Pill>
                      ) : (
                        <Pill tone="warn">
                          {item.pieces.length - item.backCount} piece{item.pieces.length - item.backCount === 1 ? "" : "s"} still out
                        </Pill>
                      )}
                    </div>
                    <div className="mt-1 text-[12.8px] text-slate-500">
                      {item.brokenAt ? `Broken ${formatHistoryDateParts(item.brokenAt).date}${item.brokenBy ? ` by ${item.brokenBy}` : ""}` : "Broken earlier"}
                      {item.reason ? ` · ${item.reason}` : ""}
                      {item.note ? ` — ${item.note}` : ""} · parent tag retired
                    </div>
                    <div className="mt-1.5 flex w-[220px] gap-[3px]">
                      {item.pieces.map((piece) => (
                        <i key={piece.stockItemId} className={cn("h-1.5 flex-1 rounded-sm", piece.state === "STOCK" ? "bg-emerald-600" : "bg-slate-200")} />
                      ))}
                    </div>
                    <div className="mt-0.5 text-[11.6px] text-slate-400">
                      {item.backCount} of {item.pieces.length} back in stock
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.outPieceIds.length > 0 && (
                      <Button type="button" variant="outline" size="sm" onClick={() => onRecall(item)} className="gap-1.5 text-xs">
                        <MoveRight className="size-3.5" /> Record return ({item.outPieceIds.length})
                      </Button>
                    )}
                    {item.state === "RESTORABLE" && (
                      <Button type="button" size="sm" onClick={() => onRestore(item)} className="gap-1.5 bg-emerald-600 text-xs text-white hover:bg-emerald-700">
                        <Merge className="size-3.5" /> Restore set
                      </Button>
                    )}
                    {item.state === "CANT_RESTORE" && item.backCount > 0 && (
                      <Button type="button" variant="outline" size="sm" onClick={() => onFormWithReplacement(item)} className="gap-1.5 text-xs">
                        <Merge className="size-3.5" /> Form with replacement
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.pieces.map((piece) => (
                    <SizeSlot key={piece.stockItemId} size={piece.size} piece={piece} tone={slotTone(piece)} />
                  ))}
                </div>
                {item.state === "CANT_RESTORE" && (
                  <p className="mt-2.5 text-[12.8px] text-slate-500">
                    {gone
                      .map((piece) => (piece.state === "INSIDE" ? `${piece.size} is now in ${piece.insideCode ?? "another set"}` : `${piece.size} was sold or written off`))
                      .join("; ")}{" "}
                    — the remaining pieces can still join a new set with a matching replacement.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BrokenSetsTab;
