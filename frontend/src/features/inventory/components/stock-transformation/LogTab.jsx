import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Loader2, Lock, Search, Undo2 } from "lucide-react";

import ActionModal from "@/components/shared/ActionModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTagJourneyApi, useTransformationLogApi, useUndoTransformationApi } from "../../hooks/useStockTransformationsApi";
import { CUSTODY, entryCode, pieceLabel } from "../../utils/stockTransformation";
import { formatHistoryDateParts, formatHistoryDateTime } from "../../utils/stockHistoryLabels";
import { ColorDot, Pill } from "../current-stock/primitives";
import { DialogFooter } from "../current-stock/formControls";
import { WhereChip } from "./ui";

const TYPES = [
  ["ALL", "All"],
  ["BREAK", "Break"],
  ["FORM", "Form"],
  ["MOVE", "Move"],
  ["RETURN", "Return"],
];

const TYPE_BADGE = {
  BREAK: ["BREAK", "bg-amber-50 text-amber-700"],
  FORM: ["FORM SET", "bg-emerald-50 text-emerald-700"],
  MOVE: ["MOVE", "bg-violet-50 text-violet-700"],
  RETURN: ["RETURN", "bg-blue-50 text-blue-700"],
  UNDO: ["UNDO", "bg-slate-100 text-slate-500"],
};

const COLS = "lg:grid-cols-[.95fr_1.3fr_2.3fr_1.1fr_.6fr_1fr_100px]";
const destinationText = (type, holder) => `${CUSTODY[type]?.short ?? "In stock"}${holder ? ` (${holder})` : ""}`;

function describe(entry) {
  const meta = entry.metadata ?? {};
  const pieces = meta.pieces ?? [];
  if (entry.type === "BREAK") {
    const out = pieces.filter((piece) => piece.custodyType !== "STOCK");
    return (
      <>
        Broke <b className="font-mono">{meta.unitCode}</b> · {pieces.length} pcs ·{" "}
        {out.length ? out.map((piece) => `${piece.size} → ${destinationText(piece.custodyType, piece.holder)}`).join(", ") : "all back to stock"}
      </>
    );
  }
  if (entry.type === "FORM") {
    return (
      <>
        {meta.restoredCode ? (
          <>
            Restored <b className="font-mono">{meta.restoredCode}</b> as{" "}
          </>
        ) : (
          "Formed "
        )}
        <b className="font-mono">{meta.unitCode}</b> from {pieces.length} pcs
      </>
    );
  }
  if (entry.type === "MOVE" || entry.type === "RETURN") {
    return (
      <>
        {pieces.length} pc{pieces.length === 1 ? "" : "s"} → {entry.type === "RETURN" ? "stock" : destinationText(meta.custodyType, meta.holder)} ·{" "}
        <span className="font-mono">{pieces.map(pieceLabel).join(", ")}</span>
      </>
    );
  }
  return (
    <>
      Undid <b className="font-mono">{entryCode(entry.targetTransformationId)}</b>
    </>
  );
}

const Journey = ({ code }) => {
  const { data, isLoading, isError } = useTagJourneyApi(code);
  if (isLoading || isError || !data) return null;
  const journey = data.data;
  return (
    <div className="mb-3.5 rounded-[13px] border-[1.5px] border-blue-200 bg-blue-50 px-4 py-3.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400">Tag journey</div>
          <div className="font-mono text-base font-bold text-slate-900">{journey.code}</div>
        </div>
        <div className="flex items-center gap-2 text-[12.8px] text-slate-600">
          Now:{" "}
          {journey.isUnit ? (
            <Pill tone={journey.unitState === "INTACT" ? "ok" : "neutral"}>{journey.unitState === "INTACT" ? "Intact set" : "No longer in stock · tag retired"}</Pill>
          ) : (
            <WhereChip piece={journey.piece} />
          )}
        </div>
      </div>
      {journey.steps.map((step, index) => (
        <div key={index} className="grid grid-cols-[100px_1fr] gap-3 border-b border-dashed border-blue-200 py-1.5 text-[12.6px] last:border-b-0">
          <span className="font-mono text-slate-500">{formatHistoryDateParts(step.at).date}</span>
          <span className="text-slate-800">
            {step.text}
            {step.entryId && <span className="ml-1.5 font-mono text-[11px] text-slate-400">{entryCode(step.entryId)}</span>}
          </span>
        </div>
      ))}
    </div>
  );
};

// "Transformation log": every break/form/move/return, searchable, with each tag's journey and a
// safe undo (refused by the server once the pieces involved have changed since).
const LogTab = () => {
  const logQuery = useTransformationLogApi();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [undoEntry, setUndoEntry] = useState(null);
  const { mutateAsync: undo, isPending } = useUndoTransformationApi();

  const entries = useMemo(() => logQuery.data?.data ?? [], [logQuery.data]);
  const q = query.trim().toLowerCase();

  // A search that looks like a tag ID shows that tag's full journey (any tag, not only ones
  // already in the log) — looked up once typing pauses; nothing is shown if it isn't a tag.
  const debouncedQuery = useDebouncedValue(query.trim(), 350);
  const journeyCode = /^[A-Za-z0-9#-]{4,}$/.test(debouncedQuery) ? debouncedQuery : null;

  const rows = entries.filter((entry) => {
    if (type !== "ALL" && entry.type !== type) return false;
    if (!q) return true;
    const meta = entry.metadata ?? {};
    const haystack = [
      entryCode(entry.id), entry.design.code, entry.design.name, entry.variant.colorName, entry.reason, entry.note, entry.createdBy,
      meta.unitCode, meta.restoredCode, meta.holder, ...(meta.pieces ?? []).flatMap((piece) => [piece.code, piece.holder]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  const handleUndo = async () => {
    try {
      await undo({ id: undoEntry.id });
      toast.success(`${entryCode(undoEntry.id)} undone.`);
      setUndoEntry(null);
    } catch (error) {
      toast.error(error.message);
      setUndoEntry(null);
    }
  };

  const undoText = (entry) => {
    const meta = entry.metadata ?? {};
    const count = meta.pieces?.length ?? 0;
    if (entry.type === "BREAK") return `put the ${count} pieces back into ${meta.unitCode} as an intact set (its parent tag becomes active again).`;
    if (entry.type === "FORM") return `take ${meta.unitCode} apart and return its pieces to loose stock (its new parent tag is retired).`;
    return `move ${count} piece${count === 1 ? "" : "s"} back to where ${count === 1 ? "it was" : "they were"}.`;
  };

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-[18px] top-1/2 size-[19px] -translate-y-1/2 text-emerald-600" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="Search by tag ID to see its full journey, or by design, person or reason"
          className="w-full rounded-[13px] border-2 border-emerald-200 bg-emerald-50 py-3.5 pl-12 pr-4 font-mono text-[14.5px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <div className="inline-flex flex-wrap gap-0.5 rounded-[10px] border border-slate-200 bg-slate-100 p-[3px]">
          {TYPES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setType(id)}
              className={cn(
                "rounded-[7px] px-3.5 py-1.5 text-[12.6px] font-semibold",
                type === id ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.1)]" : "text-slate-500 hover:text-slate-800",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[12.5px] text-slate-400">
          {rows.length} entr{rows.length === 1 ? "y" : "ies"}
        </span>
      </div>

      <div className="mt-3.5">
        {journeyCode && <Journey code={journeyCode} />}
        {logQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> Loading log…
          </div>
        ) : logQuery.isError ? (
          <div className="py-10 text-center text-sm text-red-600">{logQuery.error.message}</div>
        ) : (
          <div className="overflow-hidden rounded-[13px] border border-slate-200">
            <div className={cn("hidden items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[9.8px] font-bold uppercase tracking-[0.07em] text-slate-400 lg:grid", COLS)}>
              <span>Entry</span>
              <span>Design · variant</span>
              <span>What happened</span>
              <span>Reason</span>
              <span>By</span>
              <span>When</span>
              <span />
            </div>
            {rows.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">
                <b className="mb-1 block text-[15px] text-slate-900">{entries.length ? "No entries match" : "No transformations yet"}</b>
                {entries.length ? "Try another search." : "Every break, set formed and piece moved is recorded here."}
              </div>
            ) : (
              rows.map((entry) => (
                <div
                  key={entry.id}
                  className={cn("grid grid-cols-2 items-center gap-3 border-b border-slate-100 px-4 py-3 text-[13px] last:border-b-0", COLS, entry.undoneAt && "opacity-50")}
                >
                  <div>
                    <span className={cn("whitespace-nowrap rounded-md px-2 py-0.5 text-[10.3px] font-bold tracking-[0.04em]", TYPE_BADGE[entry.type][1])}>
                      {TYPE_BADGE[entry.type][0]}
                    </span>
                    <div className="mt-1 font-mono text-[11.6px] text-slate-400">{entryCode(entry.id)}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ColorDot hex={entry.variant.colorHex} />
                    <b>{entry.design.code}</b> {entry.variant.colorName}
                  </div>
                  <div className="text-[12.6px]">{describe(entry)}</div>
                  <div>
                    <b className="text-[12.3px]">{entry.reason}</b>
                    {entry.note && <div className="text-[11.6px] text-slate-400">{entry.note}</div>}
                  </div>
                  <span className="text-slate-600">{entry.createdBy ?? "—"}</span>
                  <span className="text-[12.3px] text-slate-500">{formatHistoryDateTime(entry.createdAt)}</span>
                  <div className="text-right">
                    {entry.undoneAt ? (
                      <Pill>Undone</Pill>
                    ) : entry.type === "UNDO" ? null : entry.canUndo ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => setUndoEntry(entry)} className="gap-1 text-xs">
                        <Undo2 className="size-3.5" /> Undo
                      </Button>
                    ) : (
                      <span title="These pieces have changed since — undo is no longer safe">
                        <Pill>
                          <Lock className="size-3" /> Locked
                        </Pill>
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {undoEntry && (
        <ActionModal
          openActionModal
          setOpenActionModal={(open) => !open && setUndoEntry(null)}
          locked={isPending}
          title={`Undo ${entryCode(undoEntry.id)}?`}
          subtitle={`This will ${undoText(undoEntry)}`}
        >
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUndoEntry(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={handleUndo} disabled={isPending} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Undo
            </Button>
          </DialogFooter>
        </ActionModal>
      )}
    </div>
  );
};

export default LogTab;
