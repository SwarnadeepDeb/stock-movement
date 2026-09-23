import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { AlertTriangle, Check, ChevronRight, Loader2, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCurrentStockVariantApi, useSetLowStockLevelApi } from "../../hooks/useCurrentStockOverviewApi";
import { adjustmentCode, formatAge, formatInr, toCount } from "../../utils/currentStock";
import { formatHistoryDateParts } from "../../utils/stockHistoryLabels";
import { ColorDot, Eyebrow, StatusPill } from "./primitives";
import { NumberInput } from "./formControls";
import WriteOffDialog from "./WriteOffDialog";

const KIND_BADGE = {
  SET: { label: "COMPLETE SET", className: "bg-emerald-50 text-emerald-700" },
  SEMI: { label: "SEMI SET", className: "bg-violet-50 text-violet-700" },
  TAGGED_PIECE: { label: "LOOSE PIECE", className: "bg-amber-50 text-amber-700" },
  LOOSE: { label: "LOOSE · UNTAGGED", className: "bg-amber-50 text-amber-700" },
};

const TAG_COLS = "grid grid-cols-[26px_1.7fr_1fr_.9fr_.6fr_.6fr] items-center gap-2.5 px-3 py-2 text-[12.3px]";

const Checkbox = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
    className={cn(
      "grid size-5 place-items-center rounded-md border-[1.5px]",
      checked ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white",
    )}
  >
    {checked && <Check className="size-3" strokeWidth={3} />}
  </button>
);

const KindBadge = ({ kind }) => (
  <span className={cn("whitespace-nowrap rounded-[5px] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.04em]", KIND_BADGE[kind].className)}>
    {KIND_BADGE[kind].label}
  </span>
);

const Age = ({ days, ageingDays }) => (
  <span className={cn("font-mono text-xs", days >= ageingDays ? "font-bold text-violet-700" : "text-slate-600")}>{formatAge(days)}</span>
);

const LowStockLevel = ({ variant }) => {
  const [value, setValue] = useState(variant.lowStockLevel);
  const { mutateAsync: saveLevel, isPending } = useSetLowStockLevelApi();

  const handleSave = async () => {
    if (value === "" || value === variant.lowStockLevel) {
      toast.info(value === "" ? "Enter 0 or more pieces." : "Level unchanged.");
      return;
    }
    try {
      await saveLevel({ colorVariantId: variant.colorVariantId, lowStockLevel: value });
      toast.success(`Low-stock level for ${variant.design.code} ${variant.colorName} set to ${value} pcs.`);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="max-w-[40ch] text-[12.8px] text-slate-500">
        Marked <b>Low</b> when pieces in stock fall to this number or below.
      </span>
      <div className="flex items-center gap-2">
        <NumberInput
          className="w-20 px-2.5 text-right"
          value={value}
          onChange={(event) => setValue(toCount(event.target.value))}
          onKeyDown={(event) => event.key === "Enter" && handleSave()}
          aria-label="Low-stock level"
        />
        <span className="text-[12.8px] text-slate-500">pcs</span>
        <Button type="button" variant="outline" size="sm" onClick={handleSave} disabled={isPending} className="gap-1.5 text-xs">
          {isPending && <Loader2 className="size-3.5 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
};

const DrawerBody = ({ detail, ageingDays, onAddStock }) => {
  const { variant, units, looseGroups, movements } = detail;
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [looseQty, setLooseQty] = useState({});
  const [expanded, setExpanded] = useState({});
  const [isWritingOff, setIsWritingOff] = useState(false);

  const gaps = variant.sizes.filter((size) => size.quantity === 0).map((size) => size.size);

  const selection = useMemo(() => {
    const bySize = new Map();
    const addSize = (label, count) => bySize.set(label, (bySize.get(label) ?? 0) + count);
    let pieceCount = 0;
    for (const unit of units) {
      if (!selectedIds.has(unit.stockItemId)) continue;
      pieceCount += unit.pieceCount;
      unit.sizes.forEach((label) => addSize(label, 1));
    }
    const loosePieces = looseGroups
      .map((group) => ({ designSizeId: group.designSizeId, size: group.size, quantity: Number(looseQty[group.designSizeId]) || 0 }))
      .filter((piece) => piece.quantity > 0);
    loosePieces.forEach((piece) => {
      pieceCount += piece.quantity;
      addSize(piece.size, piece.quantity);
    });
    return {
      stockItemIds: [...selectedIds],
      loosePieces: loosePieces.map(({ designSizeId, quantity }) => ({ designSizeId, quantity })),
      pieceCount,
      sizeSummary: [...bySize.entries()].map(([label, count]) => `${label}:${count}`).join("  "),
    };
  }, [units, looseGroups, selectedIds, looseQty]);

  const toggleUnit = (id) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clearSelection = () => {
    setSelectedIds(new Set());
    setLooseQty({});
  };

  const tagCount = units.length + looseGroups.length;

  const summaryCells = [
    { value: variant.totalPieces, label: "Pieces in stock" },
    {
      value: (
        <>
          {variant.sets} <span className="text-xs text-slate-400">/</span> {variant.semiSets} <span className="text-xs text-slate-400">/</span>{" "}
          {variant.loosePieces}
        </>
      ),
      label: "Sets / semi / loose",
    },
    { value: formatInr(variant.value), label: "Stock value", className: "text-emerald-700" },
    {
      value: variant.totalPieces ? (variant.oldestDays ? `${variant.oldestDays} days` : "Today") : "—",
      label: "Oldest piece in stock",
      className: variant.isAgeing ? "text-violet-700" : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      {!variant.ledgerMatches && (
        <div className="flex items-start gap-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.8px] text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 flex-none" />
          <div>
            The stock ledger shows <b>{variant.ledgerPieces} pcs</b> but the tagged items add up to <b>{variant.totalPieces} pcs</b>.
            This page counts the items; a stock count would confirm which is right.
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 sm:grid-cols-4">
        {summaryCells.map((cell) => (
          <div key={cell.label} className="border-b border-r border-slate-200 px-3.5 py-3 last:border-r-0 sm:border-b-0">
            <div className={cn("font-mono text-[17px] font-bold text-slate-900", cell.className)}>{cell.value}</div>
            <div className="mt-0.5 text-[10.8px] text-slate-500">{cell.label}</div>
          </div>
        ))}
      </div>

      <div>
        <Eyebrow className="mb-2.5">Size availability</Eyebrow>
        <div className="flex flex-wrap gap-2">
          {variant.sizes.map((size) => (
            <div
              key={size.designSizeId}
              className={cn(
                "min-w-16 flex-1 rounded-[11px] border px-1.5 py-2.5 text-center",
                size.quantity === 0 ? "border-red-200 bg-red-50" : size.quantity <= 2 ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white",
              )}
            >
              <div className="text-[10.5px] font-bold text-slate-400">{size.size}</div>
              <div
                className={cn(
                  "mt-0.5 font-mono text-xl font-bold",
                  size.quantity === 0 ? "text-red-700" : size.quantity <= 2 ? "text-amber-700" : "text-slate-900",
                )}
              >
                {size.quantity}
              </div>
            </div>
          ))}
        </div>
        {variant.totalPieces > 0 && gaps.length > 0 && (
          <div className="mt-2.5 flex items-start gap-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12.8px] text-amber-800">
            <AlertTriangle className="mt-0.5 size-3.5 flex-none" />
            <div>
              No <b>{gaps.join(", ")}</b> left — complete sets can’t be supplied for this variant.
            </div>
          </div>
        )}
      </div>

      <div>
        <Eyebrow className="mb-2.5">Low-stock level</Eyebrow>
        <LowStockLevel key={variant.lowStockLevel} variant={variant} />
      </div>

      <div>
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2.5">
          <Eyebrow>Tags in stock · {tagCount}</Eyebrow>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onAddStock} className="gap-1 text-xs">
              <Plus className="size-3.5" />
              Add stock
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selection.pieceCount === 0}
              onClick={() => setIsWritingOff(true)}
              className="gap-1 border-red-200 text-xs text-red-700 hover:bg-red-50"
            >
              <Trash2 className="size-3.5" />
              Write off{selection.pieceCount ? ` ${selection.pieceCount} pc${selection.pieceCount === 1 ? "" : "s"}` : ""}
            </Button>
          </div>
        </div>

        {tagCount === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-6 py-6 text-center text-sm text-slate-500">
            <b className="mb-1 block text-[15px] text-slate-900">No stock left</b>
            All pieces of this variant have been sold or written off.
          </div>
        ) : (
          <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-200">
            <div className={cn(TAG_COLS, "sticky top-0 z-[1] bg-slate-50 text-[9.5px] font-bold uppercase tracking-[0.06em] text-slate-400")}>
              <span />
              <span>Tag ID</span>
              <span>Type</span>
              <span>Sizes</span>
              <span>Pcs</span>
              <span>Age</span>
            </div>

            {units.map((unit) => {
              const isSelected = selectedIds.has(unit.stockItemId);
              const canExpand = unit.children.length > 0;
              return (
                <div key={unit.stockItemId}>
                  <div className={cn(TAG_COLS, "border-t border-slate-100", isSelected && "bg-red-50")}>
                    <Checkbox checked={isSelected} onChange={() => toggleUnit(unit.stockItemId)} label={`Select ${unit.shortCode ?? unit.stockItemId}`} />
                    <div className="flex min-w-0 items-center gap-1.5">
                      {canExpand ? (
                        <button
                          type="button"
                          onClick={() => setExpanded((current) => ({ ...current, [unit.stockItemId]: !current[unit.stockItemId] }))}
                          className="grid size-[22px] flex-none place-items-center rounded-md border border-slate-200 text-slate-400 hover:text-slate-700"
                          aria-label="Show child tags"
                        >
                          <ChevronRight className={cn("size-3 transition-transform", expanded[unit.stockItemId] && "rotate-90")} />
                        </button>
                      ) : (
                        <span className="w-[22px] flex-none" />
                      )}
                      <span className="truncate font-mono font-semibold text-slate-900" title={unit.challanNo ? `Challan ${unit.challanNo}` : undefined}>
                        {unit.shortCode ?? `#${unit.stockItemId}`}
                      </span>
                    </div>
                    <span>
                      <KindBadge kind={unit.kind} />
                    </span>
                    <span className="font-mono text-[11.3px] text-slate-500">{unit.sizes.join(" ")}</span>
                    <span className="font-mono text-slate-700">{unit.pieceCount}</span>
                    <Age days={unit.ageDays} ageingDays={ageingDays} />
                  </div>
                  {expanded[unit.stockItemId] &&
                    unit.children.map((child) => (
                      <div key={child.stockItemId} className={cn(TAG_COLS, "border-t border-slate-100 bg-slate-50 text-[11.8px]")}>
                        <span />
                        <span className="pl-7 font-mono text-slate-700">{child.shortCode ?? `#${child.stockItemId}`}</span>
                        <span className="text-[11.6px] text-slate-400">Piece in {unit.kind === "SET" ? "set" : "semi set"}</span>
                        <span className="font-mono">{child.size ?? "—"}</span>
                        <span className="font-mono">1</span>
                        <span />
                      </div>
                    ))}
                </div>
              );
            })}

            {looseGroups.map((group) => {
              const qty = looseQty[group.designSizeId] ?? "";
              return (
                <div key={group.designSizeId} className={cn(TAG_COLS, "border-t border-slate-100", Number(qty) > 0 && "bg-red-50")}>
                  <span />
                  <div className="flex items-center gap-1.5">
                    <span className="w-[22px] flex-none" />
                    <label className="flex items-center gap-1.5 text-[11.6px] text-slate-500">
                      Write off
                      <NumberInput
                        className="w-14 px-1.5 py-1 text-center text-xs"
                        max={group.quantity}
                        placeholder="0"
                        value={qty}
                        onChange={(event) => {
                          const next = toCount(event.target.value);
                          setLooseQty((current) => ({ ...current, [group.designSizeId]: next === "" ? "" : Math.min(next, group.quantity) }));
                        }}
                        aria-label={`Loose ${group.size} pieces to write off`}
                      />
                    </label>
                  </div>
                  <span>
                    <KindBadge kind="LOOSE" />
                  </span>
                  <span className="font-mono text-[11.3px] text-slate-500">{group.size}</span>
                  <span className="font-mono text-slate-700">{group.quantity}</span>
                  <Age days={group.ageDays} ageingDays={ageingDays} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <Eyebrow className="mb-2.5">Movement history</Eyebrow>
        {movements.length === 0 ? (
          <div className="text-[12.8px] text-slate-500">No movements yet.</div>
        ) : (
          movements.map((movement, index) => (
            <div
              key={`${movement.at}-${index}`}
              className={cn(
                "grid grid-cols-[92px_1fr_auto] items-center gap-3 border-b border-dashed border-slate-200 py-2.5 text-[12.6px] last:border-b-0",
                movement.reversed && "opacity-50",
              )}
            >
              <span className="text-[11.8px] text-slate-500">{formatHistoryDateParts(movement.at).date}</span>
              <div>
                {movement.title}
                {(movement.reference || movement.adjustmentId) && (
                  <div className="text-[11.6px] text-slate-400">
                    {[movement.adjustmentId ? adjustmentCode(movement.adjustmentId) : null, movement.reference, movement.reversed ? "reversed" : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
              </div>
              {movement.quantity === null ? (
                <span />
              ) : (
                <span className={cn("font-mono font-bold", movement.direction === "IN" ? "text-emerald-700" : "text-red-700")}>
                  {movement.direction === "IN" ? "+" : "−"}
                  {movement.quantity}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {isWritingOff && (
        <WriteOffDialog
          variant={variant}
          selection={selection}
          onClose={() => setIsWritingOff(false)}
          onDone={() => {
            setIsWritingOff(false);
            clearSelection();
          }}
        />
      )}
    </div>
  );
};

// Right-hand drawer with one variant in full detail — fetched fresh on open so tags and history
// are never stale after an adjustment made elsewhere.
const VariantDrawer = ({ colorVariantId, ageingDays, onClose, onAddStock }) => {
  const { data, isLoading, isError, error } = useCurrentStockVariantApi(colorVariantId);
  const detail = data?.data;
  const variant = detail?.variant;

  useEffect(() => {
    const handleKey = (event) => {
      // An open dialog (Add stock / Write off) handles its own Escape first.
      if (event.key === "Escape" && !document.querySelector("[data-slot='dialog-content']")) onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Variant stock detail"
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[760px] flex-col bg-white shadow-[-10px_0_40px_rgba(15,23,42,0.14)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5">
          <div className="min-w-0">
            <Eyebrow className="mb-1">Variant stock</Eyebrow>
            <div className="flex items-center gap-2 text-lg font-bold text-slate-900">
              {variant ? (
                <>
                  <ColorDot hex={variant.colorHex} className="size-3" />
                  {variant.design.code} · {variant.colorName}
                </>
              ) : (
                "—"
              )}
            </div>
            {variant && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.8px] text-slate-500">
                {variant.design.name} · {formatInr(variant.design.sellingPricePerPiece)}/pc
                <StatusPill variant={variant} />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-[30px] flex-none place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-8 pt-5">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" /> Loading variant…
            </div>
          ) : isError ? (
            <div className="py-16 text-center text-sm text-red-600">{error.message}</div>
          ) : (
            <DrawerBody key={colorVariantId} detail={detail} ageingDays={ageingDays} onAddStock={() => onAddStock(colorVariantId)} />
          )}
        </div>
      </aside>
    </>
  );
};

export default VariantDrawer;
