import { Loader2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { adjustmentCode } from "../../utils/currentStock";
import { formatHistoryDateTime } from "../../utils/stockHistoryLabels";
import { ColorDot, Pill } from "./primitives";

const COLS = "lg:grid-cols-[.9fr_1.6fr_1.4fr_1.5fr_.6fr_1fr_110px]";

const TYPE_BADGE = {
  ADD: { label: "STOCK ADDED", className: "bg-emerald-50 text-emerald-700" },
  REMOVE: { label: "WRITTEN OFF", className: "bg-red-50 text-red-700" },
  LEVEL: { label: "LOW-STOCK LEVEL", className: "bg-blue-50 text-blue-700" },
  REVERSE: { label: "REVERSAL", className: "bg-slate-100 text-slate-500" },
};

const ChangeCell = ({ entry }) => {
  if (entry.type === "LEVEL") {
    return (
      <span>
        Level {entry.fromLevel} → <b>{entry.toLevel}</b>
      </span>
    );
  }
  if (entry.type === "REVERSE") {
    return (
      <span>
        Reversed <span className="font-mono">{adjustmentCode(entry.targetAdjustmentId)}</span>
      </span>
    );
  }
  const isAdd = entry.type === "ADD";
  return (
    <span>
      <b className={cn("font-mono", isAdd ? "text-emerald-700" : "text-red-700")}>
        {isAdd ? "+" : "−"}
        {entry.quantity} pcs
      </b>{" "}
      {entry.sizeSummary && <span className="text-[11.6px] text-slate-400">{entry.sizeSummary}</span>}
    </span>
  );
};

const AdjustmentLog = ({ entries, isLoading, error, onReverse }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
        <Loader2 className="size-4 animate-spin" /> Loading adjustment log…
      </div>
    );
  }
  if (error) return <div className="py-10 text-center text-sm text-red-600">{error.message}</div>;

  return (
    <div className="overflow-hidden rounded-[13px] border border-slate-200">
      <div
        className={cn(
          "hidden items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[9.8px] font-bold uppercase tracking-[0.07em] text-slate-400 lg:grid",
          COLS,
        )}
      >
        <span>Entry</span>
        <span>Design · variant</span>
        <span>Change</span>
        <span>Reason &amp; note</span>
        <span>By</span>
        <span>When</span>
        <span />
      </div>

      {entries.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-slate-500">
          <b className="mb-1 block text-[15px] text-slate-900">No adjustments yet</b>
          Every manual change to stock is recorded here.
        </div>
      ) : (
        entries.map((entry) => {
          const badge = TYPE_BADGE[entry.type];
          const isReversed = Boolean(entry.reversedAt);
          return (
            <div
              key={entry.id}
              className={cn(
                "grid grid-cols-2 items-center gap-3 border-b border-slate-100 px-4 py-3 text-[13px] last:border-b-0",
                COLS,
                isReversed && "opacity-55",
              )}
            >
              <div>
                <span className={cn("whitespace-nowrap rounded-md px-2 py-0.5 text-[10.5px] font-bold tracking-[0.04em]", badge.className)}>
                  {badge.label}
                </span>
                <div className="mt-1 font-mono text-[11.6px] text-slate-400">{adjustmentCode(entry.id)}</div>
              </div>
              <div className="flex items-center gap-2">
                <ColorDot hex={entry.variant.colorHex} />
                <div>
                  <b>{entry.design.code}</b> {entry.variant.colorName}
                </div>
              </div>
              <div>
                <ChangeCell entry={entry} />
              </div>
              <div className={cn(isReversed && "line-through")}>
                <b className="text-[12.6px]">{entry.reason}</b>
                {entry.note && <div className="text-[11.6px] text-slate-400">{entry.note}</div>}
              </div>
              <span className="text-slate-600">{entry.createdBy ?? "—"}</span>
              <span className="text-[12.3px] text-slate-500">{formatHistoryDateTime(entry.createdAt)}</span>
              <div className="text-right">
                {entry.type === "REVERSE" ? null : isReversed ? (
                  <Pill>Reversed</Pill>
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={() => onReverse(entry)} className="gap-1 text-xs">
                    <Undo2 className="size-3.5" />
                    Reverse
                  </Button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default AdjustmentLog;
