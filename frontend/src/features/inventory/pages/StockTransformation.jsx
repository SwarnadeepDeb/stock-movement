import { useEffect, useMemo, useState } from "react";
import { Loader2, Merge, MoveRight, Sparkles, Split, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTransformationOverviewApi } from "../hooks/useStockTransformationsApi";
import { isFormable, suggestionKey } from "../utils/stockTransformation";
import { Sheet } from "../components/current-stock/primitives";
import FormationTab from "../components/stock-transformation/FormationTab";
import BrokenSetsTab from "../components/stock-transformation/BrokenSetsTab";
import PiecesOutTab from "../components/stock-transformation/PiecesOutTab";
import LogTab from "../components/stock-transformation/LogTab";
import BreakFlow from "../components/stock-transformation/BreakFlow";
import FormFlow from "../components/stock-transformation/FormFlow";
import MoveFlow from "../components/stock-transformation/MoveFlow";

const Stat = ({ value, label, className }) => (
  <div className="flex-1 basis-1/2 border-b border-slate-200 px-5 py-3.5 md:basis-0 md:border-b-0 md:border-r md:last:border-r-0">
    <div className={cn("font-mono text-xl font-bold text-slate-900", className)}>{value}</div>
    <div className="mt-0.5 text-[11.3px] text-slate-500">{label}</div>
  </div>
);

const ActionCard = ({ icon: Icon, tone, title, text, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-start gap-3.5 rounded-[14px] border-[1.5px] border-slate-200 bg-white px-4 py-4 text-left transition-[border-color,box-shadow] hover:border-emerald-500 hover:shadow-[0_6px_18px_rgba(5,150,105,0.08)]"
  >
    <span className={cn("grid size-10 flex-none place-items-center rounded-[11px]", tone)}>
      <Icon className="size-5" />
    </span>
    <span>
      <span className="block text-[14.5px] font-bold text-slate-900">{title}</span>
      <span className="mt-0.5 block text-[12.3px] leading-snug text-slate-500">{text}</span>
    </span>
  </button>
);

const TabButton = ({ active, count, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-[13.5px] font-semibold transition-colors",
      active ? "border-emerald-600 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800",
    )}
  >
    {children}
    <span className="ml-1.5 font-mono text-[11px] text-slate-400">{count}</span>
  </button>
);

// Suggestion → FormFlow preset (which pieces go in which size position).
const presetFrom = (suggestion) => ({
  colorVariantId: suggestion.colorVariantId,
  kind: suggestion.formKind,
  slots: suggestion.slots.filter((slot) => slot.piece).map((slot) => ({ designSizeId: slot.designSizeId, size: slot.size, stockItemId: slot.piece.stockItemId })),
});

const StockTransformation = () => {
  const [tab, setTab] = useState("formation");
  const [flow, setFlow] = useState(null); // { type: "break" | "form" | "move", ...preset }
  const [popup, setPopup] = useState(null);
  const overviewQuery = useTransformationOverviewApi();
  const overview = overviewQuery.data?.data;
  const suggestions = useMemo(() => overview?.suggestions ?? [], [overview]);
  const holders = overview?.holders ?? {};

  // Auto-hide the smart popup after a while.
  useEffect(() => {
    if (!popup) return undefined;
    const timer = setTimeout(() => setPopup(null), 15000);
    return () => clearTimeout(timer);
  }, [popup]);

  const closeFlow = () => setFlow(null);

  // After any action: refresh, and if it made a new set possible (e.g. a sample came back), say so.
  const handleDone = async () => {
    const before = new Set(suggestions.filter(isFormable).map(suggestionKey));
    setFlow(null);
    const { data } = await overviewQuery.refetch();
    const fresh = (data?.data?.suggestions ?? []).filter((suggestion) => isFormable(suggestion) && !before.has(suggestionKey(suggestion)));
    if (fresh.length) setPopup({ suggestion: fresh[0], more: fresh.length - 1 });
  };

  if (overviewQuery.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
        <Loader2 className="size-4 animate-spin" /> Loading stock transformation…
      </div>
    );
  }
  if (overviewQuery.isError) {
    return (
      <div className="mx-auto max-w-lg py-24 text-center text-sm">
        <p className="text-red-600">{overviewQuery.error.message}</p>
        <Button type="button" variant="outline" className="mt-3" onClick={() => overviewQuery.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const { stats } = overview;
  const openMove = (pieces, destination = null, reason = "", after) =>
    setFlow({ type: "move", pieces, destination, reason, after });

  return (
    <div className="mx-auto flex w-full max-w-[1340px] flex-col gap-5">
      <Sheet>
        <h1 className="text-[26px] font-bold tracking-tight text-slate-900">Stock Transformation</h1>
        <p className="mt-1 max-w-[72ch] text-sm text-slate-500">
          Break sets when pieces are needed elsewhere, track where every piece goes, and bring loose pieces back together as complete
          sets — with a full log of every move.
        </p>
        <div className="mt-5 flex flex-wrap overflow-hidden rounded-xl border border-slate-200 bg-slate-50 md:flex-nowrap">
          <Stat value={stats.looseInStock} label="Loose pieces in stock" />
          <Stat
            value={
              <>
                {stats.piecesOut}
                {stats.piecesOverdue > 0 && <span className="ml-1.5 text-xs text-red-600">{stats.piecesOverdue} overdue</span>}
              </>
            }
            label="Pieces out of stock"
          />
          <Stat value={stats.setsFormable} label="Sets you can form now" className={stats.setsFormable ? "text-emerald-700" : undefined} />
          <Stat value={stats.brokenTracked} label="Broken sets tracked" />
        </div>
      </Sheet>

      {stats.setsFormable > 0 && (
        <div className="flex flex-wrap items-center gap-3.5 rounded-[14px] border-[1.5px] border-emerald-200 bg-emerald-50 px-5 py-3.5">
          <Sparkles className="size-5 flex-none text-emerald-600" />
          <div className="flex-1 text-[13.3px] leading-relaxed text-emerald-800">
            <b>
              {stats.setsFormable} complete set{stats.setsFormable === 1 ? "" : "s"} can be formed from loose pieces right now
            </b>
            {stats.setsRestorable
              ? ` — including ${stats.setsRestorable} original set${stats.setsRestorable === 1 ? "" : "s"} with every piece back.`
              : "."}{" "}
            Complete sets sell faster and keep stock tidy.
          </div>
          <Button type="button" size="sm" onClick={() => setTab("formation")} className="bg-emerald-600 text-white hover:bg-emerald-700">
            Review suggestions
          </Button>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        <ActionCard
          icon={Split}
          tone="bg-amber-50 text-amber-700"
          title="Break a set"
          text="Scan a parent tag and choose where each piece goes — stock, display, salesperson, sample or alteration."
          onClick={() => setFlow({ type: "break" })}
        />
        <ActionCard
          icon={Merge}
          tone="bg-emerald-50 text-emerald-700"
          title="Form a set"
          text="Bundle loose pieces into a complete set or semi set, with a new parent tag."
          onClick={() => setFlow({ type: "form" })}
        />
        <ActionCard
          icon={MoveRight}
          tone="bg-violet-50 text-violet-700"
          title="Move or return pieces"
          text="Record a piece going out or coming back — returns can unlock new sets instantly."
          onClick={() => openMove([])}
        />
      </div>

      <Sheet>
        <div className="-mt-1 mb-4 flex gap-0.5 overflow-x-auto border-b border-slate-200">
          <TabButton active={tab === "formation"} count={suggestions.length} onClick={() => setTab("formation")}>
            Set formation
          </TabButton>
          <TabButton active={tab === "broken"} count={stats.brokenTracked} onClick={() => setTab("broken")}>
            Broken sets
          </TabButton>
          <TabButton active={tab === "out"} count={stats.piecesOut} onClick={() => setTab("out")}>
            Pieces out
          </TabButton>
          <TabButton active={tab === "log"} count={stats.logEntries} onClick={() => setTab("log")}>
            Transformation log
          </TabButton>
        </div>

        {tab === "formation" && (
          <FormationTab
            suggestions={suggestions}
            onForm={(suggestion) => setFlow({ type: "form", preset: presetFrom(suggestion) })}
            onRecall={(suggestion) =>
              openMove(suggestion.slots.filter((slot) => slot.recall).map((slot) => slot.piece), "STOCK", "Returned to complete a set")
            }
          />
        )}
        {tab === "broken" && (
          <BrokenSetsTab
            brokenSets={overview.brokenSets}
            onRecall={(item) => openMove(item.pieces.filter((piece) => piece.state === "OUT"), "STOCK", "Returned to complete a set")}
            onRestore={(item) =>
              setFlow({
                type: "form",
                preset: {
                  colorVariantId: item.colorVariantId,
                  kind: item.unit.kind,
                  slots: item.pieces.map((piece) => ({ designSizeId: piece.designSizeId, size: piece.size, stockItemId: piece.stockItemId })),
                },
              })
            }
            onFormWithReplacement={(item) => setFlow({ type: "form", preset: { colorVariantId: item.colorVariantId, kind: "SET", slots: [] } })}
          />
        )}
        {tab === "out" && (
          <PiecesOutTab
            piecesOut={overview.piecesOut}
            overdueDays={overview.overdueDays}
            onMove={(pieces, after) => openMove(pieces, null, "", after)}
            onReturn={(pieces, after) => openMove(pieces, "STOCK", "", after)}
          />
        )}
        {tab === "log" && <LogTab />}
      </Sheet>

      {flow?.type === "break" && <BreakFlow holders={holders} onClose={closeFlow} onDone={handleDone} />}
      {flow?.type === "form" && (
<FormFlow preset={flow.preset} onClose={closeFlow} onDone={handleDone} />
      )}
      {flow?.type === "move" && (
        <MoveFlow
          presetPieces={flow.pieces}
          presetDestination={flow.destination}
          presetReason={flow.reason}
          holders={holders}
          onClose={closeFlow}
          onDone={() => {
            flow.after?.();
            handleDone();
          }}
        />
      )}

      {popup && (
        <div role="status" aria-live="polite" className="fixed bottom-6 right-6 z-[85] w-[min(380px,calc(100%-32px))] rounded-2xl border-[1.5px] border-emerald-500 bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.22)]">
          <div className="flex items-start gap-3">
            <span className="grid size-[34px] flex-none place-items-center rounded-[10px] bg-emerald-50 text-emerald-600">
              <Sparkles className="size-[18px]" />
            </span>
            <div className="flex-1">
              <div className="text-sm font-bold text-slate-900">{popup.suggestion.kind === "RESTORE" ? "Set can be restored" : "New set possible"}</div>
              <div className="mt-0.5 text-[12.8px] text-slate-600">
                {popup.suggestion.kind === "RESTORE" ? (
                  <>
                    Every piece of <b className="font-mono">{popup.suggestion.unit.code}</b> is back in stock.
                  </>
                ) : (
                  `${popup.suggestion.design.code} ${popup.suggestion.variant.colorName}: loose pieces now cover all sizes${popup.suggestion.challans?.length > 1 ? " (mixed challans)" : ""}.`
                )}
                {popup.more > 0 && <span className="text-slate-400"> +{popup.more} more</span>}
              </div>
              <div className="mt-2.5 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setFlow({ type: "form", preset: presetFrom(popup.suggestion) });
                    setPopup(null);
                  }}
                  className="bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                >
                  {popup.suggestion.kind === "RESTORE" ? "Restore now" : "Form now"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setPopup(null)} className="text-xs">
                  Later
                </Button>
              </div>
            </div>
            <button type="button" aria-label="Dismiss" onClick={() => setPopup(null)} className="text-slate-400 hover:text-slate-700">
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockTransformation;
