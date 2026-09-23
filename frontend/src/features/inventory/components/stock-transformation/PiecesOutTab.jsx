import { useState } from "react";
import { Check, MoveRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pieceLabel } from "../../utils/stockTransformation";
import { ColorDot, Pill } from "../current-stock/primitives";
import { CustodyChip } from "./ui";

const GROUP_ORDER = ["SALESPERSON", "SAMPLE", "ALTERATION", "DISPLAY"];

// "Pieces out": still owned, but not on the shelf — grouped by who has them, overdue highlighted.
const PiecesOutTab = ({ piecesOut, overdueDays, onMove, onReturn }) => {
  const [selected, setSelected] = useState(() => new Set());
  const liveSelected = piecesOut.filter((piece) => selected.has(piece.stockItemId));

  const groups = new Map();
  for (const piece of piecesOut) {
    const key = `${piece.custody.type}|${piece.custody.holder ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(piece);
  }
  const keys = [...groups.keys()].sort((a, b) => GROUP_ORDER.indexOf(a.split("|")[0]) - GROUP_ORDER.indexOf(b.split("|")[0]) || a.localeCompare(b));

  const toggle = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const done = () => setSelected(new Set());

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 max-w-[80ch] text-[12.8px] text-slate-500">
          Pieces that are still yours but not on the shelf. Overdue pieces are highlighted — salesperson after {overdueDays.SALESPERSON} days,
          customer samples after {overdueDays.SAMPLE}, alteration after {overdueDays.ALTERATION}.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!liveSelected.length} onClick={() => onMove(liveSelected, done)} className="gap-1.5 text-xs">
            <MoveRight className="size-3.5" /> Move selected
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!liveSelected.length}
            onClick={() => onReturn(liveSelected, done)}
            className="bg-emerald-600 text-xs text-white hover:bg-emerald-700"
          >
            Return {liveSelected.length || ""} to stock
          </Button>
        </div>
      </div>

      {piecesOut.length === 0 ? (
        <div className="rounded-[13px] border border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
          <b className="mb-1 block text-[15px] text-slate-900">Everything is on the shelf</b>
          No pieces are out on display, with salespeople, as samples or at alteration.
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => {
            const [type, holder] = key.split("|");
            const pieces = groups.get(key);
            const overdue = pieces.filter((piece) => piece.custody.overdue).length;
            return (
              <div key={key} className="overflow-hidden rounded-[14px] border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <CustodyChip type={type} />
                    <b>{holder || "Shop"}</b>
                    {overdue > 0 && <Pill tone="red">{overdue} overdue</Pill>}
                  </div>
                  <span className="text-[12.8px] text-slate-500">
                    {pieces.length} piece{pieces.length === 1 ? "" : "s"}
                  </span>
                </div>
                {pieces.map((piece) => (
                  <div
                    key={piece.stockItemId}
                    className={cn(
                      "grid grid-cols-2 items-center gap-2.5 border-b border-slate-100 px-4 py-2.5 text-[12.6px] last:border-b-0 lg:grid-cols-[28px_1.4fr_1.4fr_.5fr_1fr_.8fr_170px]",
                      piece.custody.overdue && "bg-red-50",
                    )}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={selected.has(piece.stockItemId)}
                      aria-label={`Select ${pieceLabel(piece)}`}
                      onClick={() => toggle(piece.stockItemId)}
                      className={cn(
                        "grid size-5 place-items-center rounded-md border-[1.5px]",
                        selected.has(piece.stockItemId) ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white",
                      )}
                    >
                      {selected.has(piece.stockItemId) && <Check className="size-3" strokeWidth={3} />}
                    </button>
                    <span className="font-mono font-semibold text-slate-900">{pieceLabel(piece)}</span>
                    <span className="flex items-center gap-1.5">
                      <ColorDot hex={piece.variant.colorHex} /> {piece.design.code} {piece.variant.colorName}
                    </span>
                    <b className="font-mono">{piece.size}</b>
                    <span className="text-slate-500">{piece.originCode ? `from ${piece.originCode}` : "loose"}</span>
                    <span className={cn("font-mono", piece.custody.overdue ? "font-bold text-red-600" : "text-slate-700")}>
                      {piece.custody.days === 0 ? "today" : `${piece.custody.days}d out`}
                    </span>
                    <div className="col-span-2 flex justify-end gap-1.5 lg:col-span-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => onMove([piece], done)} className="text-xs">
                        Move
                      </Button>
                      <Button type="button" size="sm" onClick={() => onReturn([piece], done)} className="bg-emerald-600 text-xs text-white hover:bg-emerald-700">
                        Return
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PiecesOutTab;
