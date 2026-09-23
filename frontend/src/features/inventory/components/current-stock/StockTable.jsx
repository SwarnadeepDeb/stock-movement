import { ChevronRight, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { aggregateSizes, formatInr, groupByDesign, sumBy } from "../../utils/currentStock";
import { AgeCell, ColorDot, Num, SizeChips, StatusPill } from "./primitives";

const DESIGN_COLS = "lg:grid-cols-[30px_1.7fr_1.9fr_.6fr_.6fr_.6fr_.8fr_.9fr_.7fr]";
const VARIANT_COLS = "lg:grid-cols-[1.5fr_1.8fr_.55fr_.55fr_.55fr_.75fr_.85fr_.7fr_1.1fr_76px]";
const HEAD = "text-[9.8px] font-bold uppercase tracking-[0.07em] text-slate-400";

const EmptyState = () => (
  <div className="px-6 py-10 text-center text-sm text-slate-500">
    <b className="mb-1 block text-[15px] text-slate-900">Nothing matches</b>
    Try another search, or clear the filters.
  </div>
);

const VariantRow = ({ variant, onOpen }) => (
  <div
    className={cn(
      "mt-1.5 grid grid-cols-2 items-center gap-2.5 rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-[12.6px] hover:border-slate-300",
      VARIANT_COLS,
    )}
  >
    <div className="col-span-2 flex items-center gap-2 lg:col-span-1">
      <ColorDot hex={variant.colorHex} />
      <div className="min-w-0">
        <b className="font-semibold text-slate-900">{variant.colorName}</b>
        <div className="font-mono text-[11px] text-slate-400">{variant.design.code}</div>
      </div>
    </div>
    <div className="col-span-2 lg:col-span-1">
      <SizeChips sizes={variant.sizes} />
    </div>
    <Num>{variant.sets}</Num>
    <Num>{variant.semiSets || "—"}</Num>
    <Num>{variant.loosePieces || "—"}</Num>
    <Num className="font-bold text-slate-900">{variant.totalPieces}</Num>
    <Num>{formatInr(variant.value)}</Num>
    <AgeCell pieces={variant.totalPieces} days={variant.oldestDays} ageing={variant.isAgeing} />
    <span>
      <StatusPill variant={variant} />
    </span>
    <div className="text-right">
      <Button type="button" variant="outline" size="sm" onClick={() => onOpen(variant.colorVariantId)} className="gap-1 text-xs">
        <Eye className="size-3.5" />
        View
      </Button>
    </div>
  </div>
);

const DesignGroup = ({ group, isOpen, onToggle, onOpen }) => {
  const { design, variants } = group;
  const pieces = sumBy(variants, (variant) => variant.totalPieces);
  const needAttention = variants.filter((variant) => variant.status !== "IN_STOCK");
  const worstIsOut = needAttention.some((variant) => variant.status === "OUT_OF_STOCK");
  const oldestDays = Math.max(-1, ...variants.filter((variant) => variant.totalPieces).map((variant) => variant.oldestDays ?? 0));

  return (
    <>
      <div className={cn("grid grid-cols-[30px_1fr] items-center gap-3 border-b border-slate-100 bg-white px-4 py-3 text-[13px]", DESIGN_COLS)}>
        <button
          type="button"
          onClick={onToggle}
          aria-label={isOpen ? "Hide variants" : "Show variants"}
          aria-expanded={isOpen}
          className="grid size-[30px] place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        >
          <ChevronRight className={cn("size-3.5 transition-transform", isOpen && "rotate-90")} />
        </button>
        <div className="min-w-0">
          <b className="font-mono text-slate-900">{design.code}</b> <span className="text-slate-600">{design.name}</span>
          <div className="mt-0.5 text-[11.6px] text-slate-400">
            {variants.length} variant{variants.length === 1 ? "" : "s"} · {formatInr(design.sellingPricePerPiece)}/pc
            {needAttention.length > 0 && (
              <>
                {" · "}
                <span className={cn("font-semibold", worstIsOut ? "text-red-600" : "text-amber-700")}>
                  {needAttention.length} need{needAttention.length === 1 ? "s" : ""} attention
                </span>
              </>
            )}
          </div>
        </div>
        <div className="col-span-2 lg:col-span-1">
          <SizeChips sizes={aggregateSizes(variants)} />
        </div>
        <Num className="hidden lg:inline">{sumBy(variants, (variant) => variant.sets)}</Num>
        <Num className="hidden lg:inline">{sumBy(variants, (variant) => variant.semiSets) || "—"}</Num>
        <Num className="hidden lg:inline">{sumBy(variants, (variant) => variant.loosePieces) || "—"}</Num>
        <Num className="font-bold text-slate-900">
          {pieces}
          <span className="lg:hidden"> pcs</span>
        </Num>
        <Num>{formatInr(sumBy(variants, (variant) => variant.value))}</Num>
        <span className="hidden lg:inline">
          <AgeCell pieces={pieces} days={oldestDays} ageing={variants.some((variant) => variant.isAgeing)} />
        </span>
      </div>

      {isOpen && (
        <div className="border-b border-slate-100 bg-slate-50 px-4 pb-3 pt-1.5 lg:pl-[58px]">
          <div className={cn("hidden gap-2.5 px-3 pb-0.5 pt-2 lg:grid", VARIANT_COLS, HEAD)}>
            <span>Variant</span>
            <span>Sizes</span>
            <span>Sets</span>
            <span>Semi</span>
            <span>Loose</span>
            <span>Pieces</span>
            <span>Value</span>
            <span>Oldest</span>
            <span>Status</span>
            <span />
          </div>
          {variants.map((variant) => (
            <VariantRow key={variant.colorVariantId} variant={variant} onOpen={onOpen} />
          ))}
        </div>
      )}
    </>
  );
};

// Design → variants table. A design is expanded when the user opened it, or automatically while
// any filter/search is narrowing the list (so matches are never hidden inside a collapsed row).
const StockTable = ({ variants, expanded, onToggle, forceOpen, onOpen }) => {
  const groups = groupByDesign(variants);

  return (
    <div className="overflow-hidden rounded-[13px] border border-slate-200">
      <div className={cn("hidden items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 lg:grid", DESIGN_COLS, HEAD)}>
        <span />
        <span>Design</span>
        <span>Size availability (all variants)</span>
        <span>Sets</span>
        <span>Semi</span>
        <span>Loose</span>
        <span>Total pcs</span>
        <span>Value</span>
        <span>Oldest</span>
      </div>
      {groups.length === 0 ? (
        <EmptyState />
      ) : (
        groups.map((group) => (
          <DesignGroup
            key={group.design.id}
            group={group}
            isOpen={forceOpen || Boolean(expanded[group.design.id])}
            onToggle={() => onToggle(group.design.id)}
            onOpen={onOpen}
          />
        ))
      )}
    </div>
  );
};

export default StockTable;
