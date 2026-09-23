import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Loader2, Merge, Printer, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCurrentStockOverviewApi } from "../../hooks/useCurrentStockOverviewApi";
import { useFormUnitApi, useVariantPoolApi } from "../../hooks/useStockTransformationsApi";
import { buildTagList, entryCode, pieceLabel } from "../../utils/stockTransformation";
import { FIELD_INPUT, OptionButton } from "../current-stock/formControls";
import { Sheet } from "../current-stock/primitives";
import { Feedback, FlowShell, WhereChip } from "./ui";
import { PrintLabels, TagLabel } from "./TagLabels";

// Best piece per slot: pieces born in the same original set first, then the challan covering the
// most slots, then the oldest piece — same rule the server's suggestions use.
function bestPick(slots, pool) {
  const candidates = (slot, taken) => pool.filter((piece) => piece.designSizeId === slot.designSizeId && !taken.has(piece.stockItemId));
  const origins = [...new Set(pool.map((piece) => piece.originUnitId).filter(Boolean))];
  for (const origin of origins) {
    const taken = new Set();
    const pick = slots.map((slot) => {
      const piece = candidates(slot, taken).find((candidate) => candidate.originUnitId === origin);
      if (piece) taken.add(piece.stockItemId);
      return piece ?? null;
    });
    if (pick.every(Boolean)) return pick.map((piece) => piece.stockItemId);
  }
  const challans = [...new Set(pool.map((piece) => piece.challanNo ?? ""))];
  const coverage = (challan) => slots.filter((slot) => pool.some((piece) => piece.designSizeId === slot.designSizeId && (piece.challanNo ?? "") === challan)).length;
  const best = challans.sort((a, b) => coverage(b) - coverage(a))[0];
  const taken = new Set();
  return slots.map((slot) => {
    const [piece] = candidates(slot, taken).sort((a, b) =>
      ((a.challanNo ?? "") === best ? 0 : 1) - ((b.challanNo ?? "") === best ? 0 : 1)
      || String(a.receivedOn).localeCompare(String(b.receivedOn))
      || a.stockItemId - b.stockItemId);
    if (piece) taken.add(piece.stockItemId);
    return piece?.stockItemId ?? null;
  });
}

const PENDING_CODE = "NEW-TAG";

// Form a set: pick one loose piece per size (complete set) or a chosen set of sizes (semi set),
// then create the new parent tag — and optionally print it plus reprints of the pieces' tags.
const FormFlow = ({ preset: rawPreset, onClose, onDone }) => {
  // A preset without pieces (e.g. "Form with replacement") only chooses the variant; sizes and
  // pieces then come from the variant itself, with the best pick pre-selected.
  const preset = rawPreset?.slots?.length ? rawPreset : null;
  const overviewQuery = useCurrentStockOverviewApi();
  const allVariants = useMemo(() => overviewQuery.data?.data?.variants ?? [], [overviewQuery.data]);
  const setVariants = useMemo(() => allVariants.filter((variant) => variant.sizes.filter((size) => size.includedInSet).length >= 2), [allVariants]);

  const [colorVariantId, setColorVariantId] = useState(rawPreset?.colorVariantId ?? null);
  const effectiveVariantId = colorVariantId ?? setVariants[0]?.colorVariantId ?? null;
  const [kind, setKind] = useState(rawPreset?.kind ?? "SET");
  const [semiSizeIds, setSemiSizeIds] = useState(preset?.kind === "SEMI" ? preset.slots.map((slot) => slot.designSizeId) : []);
  // Picked stockItemId per slot index (null = not picked). Seeded from a suggestion, else best pick.
  const [picks, setPicks] = useState(preset?.slots.map((slot) => slot.stockItemId) ?? null);
  const [reprint, setReprint] = useState(true);
  const [printing, setPrinting] = useState(null);

  const poolQuery = useVariantPoolApi(effectiveVariantId);
  const pool = useMemo(() => poolQuery.data?.data?.pieces ?? [], [poolQuery.data]);
  const poolInfo = poolQuery.data?.data;
  const { mutateAsync: formUnit, isPending } = useFormUnitApi();

  const variant = allVariants.find((item) => item.colorVariantId === effectiveVariantId);
  const designs = useMemo(() => {
    const map = new Map();
    for (const item of setVariants) if (!map.has(item.design.id)) map.set(item.design.id, item.design);
    return [...map.values()];
  }, [setVariants]);

  // The size positions being filled: every set size, or the chosen semi-set sizes (a preset may
  // repeat a size, e.g. restoring a semi set that held two of one size).
  const slots = useMemo(() => {
    const sizes = variant?.sizes ?? [];
    if (preset && preset.colorVariantId === effectiveVariantId && kind === preset.kind) {
      return preset.slots.map((slot) => ({ designSizeId: slot.designSizeId, size: slot.size }));
    }
    const chosen = kind === "SET" ? sizes.filter((size) => size.includedInSet) : sizes.filter((size) => semiSizeIds.includes(size.designSizeId));
    return chosen.map((size) => ({ designSizeId: size.designSizeId, size: size.size }));
  }, [variant, kind, semiSizeIds, preset, effectiveVariantId]);

  // Until the user (or a preset) has picked, show the best pick.
  const effectivePicks = picks && picks.length === slots.length ? picks : poolQuery.data ? bestPick(slots, pool) : slots.map(() => null);
  const chosen = effectivePicks.map((id) => pool.find((piece) => piece.stockItemId === id) ?? null);
  const setSizeCount = variant?.sizes.filter((size) => size.includedInSet).length ?? 0;
  const complete = slots.length >= 2 && chosen.every(Boolean) && new Set(effectivePicks).size === effectivePicks.length;
  const semiIsFullSet = kind === "SEMI" && slots.length >= setSizeCount && setSizeCount > 0;
  const challans = [...new Set(chosen.filter(Boolean).map((piece) => piece.challanNo).filter(Boolean))];
  const origins = [...new Set(chosen.filter(Boolean).map((piece) => piece.originUnitId))];
  const restoring = complete && origins.length === 1 && origins[0] && chosen.every((piece) => piece.tagged)
    && pool.filter((piece) => piece.originUnitId === origins[0]).length === chosen.length;
  const taggedChosen = chosen.filter((piece) => piece?.tagged);

  const resetPicks = () => setPicks(null);

  const handleVariantChange = (id) => {
    setColorVariantId(id);
    setSemiSizeIds([]);
    resetPicks();
  };

  const toggleSemiSize = (designSizeId) => {
    setSemiSizeIds((current) => (current.includes(designSizeId) ? current.filter((id) => id !== designSizeId) : [...current, designSizeId]));
    resetPicks();
  };

  const setPick = (index, stockItemId) => {
    const next = [...effectivePicks];
    next[index] = stockItemId ? Number(stockItemId) : null;
    setPicks(next);
  };

  const submit = async (print) => {
    if (!complete) {
      toast.error("Pick a different loose piece for every size.");
      return;
    }
    try {
      const result = await formUnit({ colorVariantId: effectiveVariantId, kind, stockItemIds: effectivePicks });
      const data = result.data;
      const what = data.restoredFrom ? `Restored ${data.restoredFrom.code ?? "the original"} as ${data.unit.code}` : `Formed ${data.unit.code}`;
      toast.success(`${what} · ${entryCode(data.entry.id)}`);
      if (print) setPrinting({ ...data.labels, unitKind: data.unit.kind });
      else onDone();
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (printing) {
    return <PrintLabels labels={printing} includeChildren={reprint} onClose={onDone} />;
  }

  const previewInfo = poolInfo
    ? { design: poolInfo.design, colorName: poolInfo.variant.colorName, sellingPricePerPiece: variant?.design.sellingPricePerPiece ?? 0 }
    : null;
  const previewTags = complete && previewInfo
    ? buildTagList(
        { unitKind: kind, parent: { code: PENDING_CODE, sizes: slots.map((slot) => slot.size) }, children: taggedChosen.map((piece) => ({ code: piece.code, size: piece.size })) },
        { includeChildren: reprint },
      )
    : [];
  const tagCount = 1 + (reprint ? taggedChosen.length : 0);

  return (
    <FlowShell
      eyebrow="Stock Transformation · aggregate"
      title="Form a set"
      onClose={onClose}
      footer={
        <>
          <span className="text-[12.8px] text-slate-500">
            {complete ? (
              <>
                <b>{chosen.length} pcs</b> → new {kind === "SET" ? "set" : "semi set"} · {tagCount} tag{tagCount === 1 ? "" : "s"} to print
              </>
            ) : (
              "Pick a piece for every size."
            )}
          </span>
          <div className="ml-auto flex flex-wrap gap-2.5">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" variant="outline" onClick={() => submit(false)} disabled={!complete || semiIsFullSet || isPending}>
              Form set · print later
            </Button>
            <Button type="button" onClick={() => submit(true)} disabled={!complete || semiIsFullSet || isPending} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
              Form set · print tags
            </Button>
          </div>
        </>
      }
    >
      <Sheet>
        {overviewQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> Loading designs…
          </div>
        ) : (
          <div className="grid gap-3.5 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-[12.3px] font-semibold text-slate-700">Design</label>
              <select
                className={FIELD_INPUT}
                value={variant?.design.id ?? ""}
                onChange={(event) => handleVariantChange(setVariants.find((item) => String(item.design.id) === event.target.value)?.colorVariantId ?? null)}
              >
                {designs.map((design) => (
                  <option key={design.id} value={design.id}>
                    {design.code} · {design.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12.3px] font-semibold text-slate-700">Variant</label>
              <select className={FIELD_INPUT} value={effectiveVariantId ?? ""} onChange={(event) => handleVariantChange(Number(event.target.value))}>
                {setVariants
                  .filter((item) => item.design.id === variant?.design.id)
                  .map((item) => (
                    <option key={item.colorVariantId} value={item.colorVariantId}>
                      {item.colorName}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12.3px] font-semibold text-slate-700">Make a</label>
              <div className="inline-flex gap-0.5 rounded-[10px] border border-slate-200 bg-slate-100 p-[3px]">
                {[
                  ["SET", "Complete set"],
                  ["SEMI", "Semi set"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setKind(id);
                      resetPicks();
                    }}
                    className={cn(
                      "rounded-[7px] px-3.5 py-1.5 text-[12.6px] font-semibold",
                      kind === id ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.1)]" : "text-slate-500",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {kind === "SEMI" && variant && !(preset && preset.kind === "SEMI" && preset.colorVariantId === effectiveVariantId) && (
          <div className="mt-3">
            <label className="mb-1.5 block text-[12.3px] font-semibold text-slate-700">Sizes in the semi set</label>
            <div className="flex flex-wrap gap-2">
              {variant.sizes.map((size) => (
                <OptionButton key={size.designSizeId} active={semiSizeIds.includes(size.designSizeId)} onClick={() => toggleSemiSize(size.designSizeId)}>
                  {size.size}
                </OptionButton>
              ))}
            </div>
          </div>
        )}
      </Sheet>

      <Sheet>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Pick a piece for each size</h2>
            <p className="mt-0.5 text-[12.8px] text-slate-500">
              Only loose pieces on the shelf are listed. Best pick prefers the same original set, then the same challan, then the oldest piece.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const best = bestPick(slots, pool);
              if (best.some((id) => id === null)) toast.info("Not every size has a loose piece in stock.");
              setPicks(best);
            }}
            className="gap-1.5 text-xs"
          >
            <Sparkles className="size-3.5" /> Best pick
          </Button>
        </div>

        <div className="overflow-hidden rounded-[13px] border border-slate-200">
          {poolQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" /> Loading loose pieces…
            </div>
          ) : slots.length === 0 ? (
            <div className="px-6 py-6 text-center text-sm text-slate-500">Pick at least 2 sizes for the semi set.</div>
          ) : (
            slots.map((slot, index) => {
              const options = pool.filter((piece) => piece.designSizeId === slot.designSizeId);
              const current = chosen[index];
              return (
                <div
                  key={`${slot.designSizeId}-${index}`}
                  className={cn("grid items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 md:grid-cols-[60px_1.4fr_1.2fr]", options.length === 0 && "bg-red-50")}
                >
                  <b className="font-mono text-[15px] text-slate-900">{slot.size}</b>
                  {options.length ? (
                    <select
                      className={cn(FIELD_INPUT, "font-mono text-[12.3px]")}
                      value={effectivePicks[index] ?? ""}
                      onChange={(event) => setPick(index, event.target.value)}
                    >
                      <option value="">Choose a {slot.size} piece</option>
                      {[...options]
                        .sort((a, b) => String(a.receivedOn).localeCompare(String(b.receivedOn)))
                        .map((piece) => (
                          <option key={piece.stockItemId} value={piece.stockItemId}>
                            {pieceLabel(piece)} · {piece.originCode ? `from ${piece.originCode}` : "loose"} · {piece.challanNo ?? "no challan"}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <span className="text-[12.6px] text-red-600">No loose {slot.size} in stock</span>
                  )}
                  <span className="flex flex-wrap items-center gap-2">
                    {current && (
                      <>
                        <WhereChip piece={current} />
                        <span className="text-[11.6px] text-slate-400">{current.originCode ? `from ${current.originCode}` : "loose"}</span>
                      </>
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-3 space-y-2.5">
          {restoring && (
            <Feedback kind="ok">
              <b>Restoring the original set.</b> Every piece of <b className="font-mono">{chosen[0].originCode}</b> is together again.
            </Feedback>
          )}
          {challans.length > 1 && (
            <Feedback kind="warn">
              These pieces come from <b>{challans.length} challans</b> ({challans.join(", ")}). Check the shade matches before bundling.
            </Feedback>
          )}
          {semiIsFullSet && <Feedback kind="warn">All sizes picked — make a complete set instead.</Feedback>}
        </div>
      </Sheet>

      {complete && previewInfo && (
        <Sheet>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">New tags · 50 × 30 mm</h2>
              <p className="mt-0.5 text-[12.8px] text-slate-500">
                A new parent tag goes on the bundle — its code is assigned when you form the set. Parent codes are never reused.
              </p>
            </div>
            {taggedChosen.length > 0 && (
              <label className="flex items-center gap-2 text-[12.6px] text-slate-700">
                <input type="checkbox" checked={reprint} onChange={(event) => setReprint(event.target.checked)} className="size-4 accent-emerald-600" />
                Reprint {taggedChosen.length} piece tag{taggedChosen.length === 1 ? "" : "s"} with the new parent ID (recommended)
              </label>
            )}
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-[#E2E8F0]">
            <div className="flex justify-between bg-[#1E293B] px-3.5 py-2 font-mono text-[10.5px] tracking-[0.06em] text-[#94A3B8]">
              <span className="text-[#34D399]">● LABEL PREVIEW · 50 × 30 mm</span>
              <span>{previewTags.length} LABELS</span>
            </div>
            <div className="flex max-h-[420px] flex-col items-center gap-3 overflow-y-auto p-4">
              {previewTags.map((tag, index) => (
                <div key={`${tag.kind}-${tag.code}-${index}`} className="flex items-center gap-3">
                  <span className="w-7 text-right font-mono text-[11px] text-[#64748B]">{String(index + 1).padStart(3, "0")}</span>
                  <TagLabel tag={tag} info={previewInfo} scale={5} />
                </div>
              ))}
            </div>
          </div>
          <p className="mt-2 text-[12.3px] text-slate-500">
            Piece tags keep scanning either way — reprinting only updates the parent ID printed on them.
          </p>
        </Sheet>
      )}

      {!complete && !poolQuery.isLoading && slots.length > 0 && chosen.some((piece) => !piece) && (
        <Feedback kind="warn">
          <span className="inline-flex items-center gap-1.5">
            <Merge className="size-3.5" /> Some sizes have no loose piece on the shelf. Return pieces that are out (Pieces out tab) or make a semi set.
          </span>
        </Feedback>
      )}
    </FlowShell>
  );
};

export default FormFlow;
