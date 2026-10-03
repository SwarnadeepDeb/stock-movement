import { forwardRef, useImperativeHandle, useRef } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr } from "../utils/format.js";
import { existingFor } from "../utils/orderLines.js";

const compact = (value) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// The colour's short label, as printed on its tags: design code + first three letters of the colour.
const colourCode = (design, variant) =>
    `${design.designCode}-${variant.colorName.replace(/\s+/g, "").slice(0, 3).toUpperCase()}`;

const wholePieces = (value) => Math.max(0, parseInt(value, 10) || 0);

// What the shop calls the garment, then the pattern — without saying the same word twice.
const designLabel = (design) =>
    [...new Set([design.itemName, design.pattern].filter(Boolean))].join(" · ");

const MarkedCode = ({ code, query }) => {
    const key = compact(query);

    if (!key || !compact(code).startsWith(key) || code !== compact(code)) return code;

    return (
        <>
            <mark className="rounded-[3px] bg-yellow-200 px-px text-inherit">{code.slice(0, key.length)}</mark>
            {code.slice(key.length)}
        </>
    );
};

const stepperInput = "w-full min-w-0 appearance-none border-0 bg-white py-1.5 text-center font-mono text-[15px] font-bold text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

// The colours of one design with a quantity box each: type pieces, step with − / +, or add a whole
// set at a time, while live stock for that colour sits beside it. Used under the finder's list and
// on its own when a hanging tag is scanned.
//
// `drafts` holds what has been typed but not yet added (colorVariantId -> text), owned by the
// parent so it survives moving to another design and back; `existing` is what the order already
// holds for this design. Enter adds, Escape backs out, ↑ / ↓ move between colours.
export const VariantPane = forwardRef(function VariantPane(
    { design, drafts, onDraft, existing, focusVariantId, onCommit, onClose, onEscape },
    ref,
) {
    const inputs = useRef({});
    const setPieces = design.setSizes.length;
    const hasExisting = design.variants.some((variant) => (existing.get(variant.colorVariantId) ?? 0) > 0);

    const valueOf = (variant) => drafts[variant.colorVariantId] ?? (existing.get(variant.colorVariantId) || "");
    const qtyOf = (variant) => wholePieces(valueOf(variant));

    const focusInput = (variantId) => {
        const list = design.variants.map((variant) => inputs.current[variant.colorVariantId]).filter(Boolean);
        const target = inputs.current[variantId]
            ?? list.find((input) => input.value)
            ?? list[0];

        target?.focus();
        target?.select();
    };

    useImperativeHandle(ref, () => ({ focusQty: focusInput }));

    const quantities = Object.fromEntries(design.variants.map((variant) => [variant.colorVariantId, qtyOf(variant)]));
    const total = Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0);
    const colours = Object.values(quantities).filter(Boolean).length;

    const commit = () => onCommit(quantities);

    const clearAll = () => {
        design.variants.forEach((variant) => onDraft(variant.colorVariantId, ""));
        focusInput(design.variants[0]?.colorVariantId);
    };

    const handleKeyDown = (event, index) => {
        if (event.key === "Enter") {
            event.preventDefault();
            commit();
        } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            (onClose ?? onEscape)?.();
        } else if (event.key === "ArrowDown" && design.variants[index + 1]) {
            event.preventDefault();
            focusInput(design.variants[index + 1].colorVariantId);
        } else if (event.key === "ArrowUp" && design.variants[index - 1]) {
            event.preventDefault();
            focusInput(design.variants[index - 1].colorVariantId);
        }
    };

    return (
        <div className="overflow-hidden rounded-xl border-[1.5px] border-white/70 bg-white/70">
            <div className="flex items-start justify-between gap-3 border-b border-white/60 bg-white/50 px-3.5 py-3">
                <div className="min-w-0">
                    <div className="text-[15px] leading-snug text-[#1E1B4B]">
                        <b className="mr-1.5 font-mono">{design.designCode}</b>
                        {designLabel(design)}
                    </div>
                    <div className="mt-0.5 text-xs text-[#1E1B4B]/55">
                        {design.quality ? `${design.quality} · ` : ""}
                        <b className="text-[#1E1B4B]">{inr(design.unitPrice)}</b>/pc
                        {setPieces > 0 && ` · 1 set = ${setPieces} pcs (${design.setSizes.join(" ")})`}
                    </div>
                </div>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        title="Close"
                        className="shrink-0 rounded-lg p-1.5 text-[#1E1B4B]/40 hover:bg-red-50 hover:text-red-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {design.variants.map((variant, index) => {
                const quantity = qtyOf(variant);
                const available = variant.availablePcs;
                const inOrder = existing.get(variant.colorVariantId) ?? 0;
                const step = variant.setPieces || setPieces;

                // Stepping with the mouse keeps the cursor in this colour's box, so Enter / Esc keep working.
                const write = (next) => {
                    onDraft(variant.colorVariantId, next > 0 ? String(next) : "");
                    inputs.current[variant.colorVariantId]?.focus();
                };
                const keepFocus = (event) => event.preventDefault();

                return (
                    <div
                        key={variant.colorVariantId}
                        className={cn(
                            "flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-white/60 px-3.5 py-2.5 transition-colors",
                            variant.colorVariantId === focusVariantId && "bg-emerald-100/70",
                            quantity > 0 && "shadow-[inset_3px_0_0_#059669]",
                        )}
                    >
                        <span className="h-3.5 w-3.5 shrink-0 rounded" style={{ background: variant.colorHex, boxShadow: "inset 0 0 0 1px rgba(15,23,42,.18)" }} />

                        <div className="flex min-w-[100px] flex-1 flex-col leading-snug">
                            <b className="text-[13.5px] text-[#1E1B4B]">{variant.colorName}</b>
                            <span className="font-mono text-[11px] text-[#1E1B4B]/45">{colourCode(design, variant)}</span>
                            {inOrder > 0 && (
                                <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-px text-[10.5px] font-bold text-emerald-700">
                                    In order: {inOrder}
                                </span>
                            )}
                        </div>

                        <span className="w-[104px] text-xs leading-tight text-[#1E1B4B]/55">
                            {available === 0 ? <b className="text-red-600">Out of stock</b>
                                : quantity > available ? <><b className="text-amber-600">Short by {quantity - available}</b> of {available}</>
                                : `${available} in stock`}
                        </span>

                        <div className="flex w-[132px] items-stretch overflow-hidden rounded-lg border-[1.5px] border-slate-300 bg-white focus-within:border-emerald-500 focus-within:ring-[3px] focus-within:ring-emerald-500/15">
                            <button
                                type="button"
                                tabIndex={-1}
                                aria-label="One less"
                                onMouseDown={keepFocus}
                                onClick={() => write(quantity - 1)}
                                className="w-8 shrink-0 bg-slate-100 text-lg font-semibold leading-none text-slate-700 hover:bg-slate-200"
                            >
                                −
                            </button>
                            <input
                                ref={(node) => { inputs.current[variant.colorVariantId] = node; }}
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={valueOf(variant)}
                                placeholder="0"
                                aria-label={`Pieces of ${variant.colorName}`}
                                onChange={(event) => onDraft(variant.colorVariantId, event.target.value)}
                                onFocus={(event) => event.target.select()}
                                onKeyDown={(event) => handleKeyDown(event, index)}
                                className={stepperInput}
                            />
                            <button
                                type="button"
                                tabIndex={-1}
                                aria-label="One more"
                                onMouseDown={keepFocus}
                                onClick={() => write(quantity + 1)}
                                className="w-8 shrink-0 bg-slate-100 text-lg font-semibold leading-none text-slate-700 hover:bg-slate-200"
                            >
                                +
                            </button>
                        </div>

                        {step > 0 && (
                            <button
                                type="button"
                                tabIndex={-1}
                                title={`Add one full set (${design.setSizes.join(" ")})`}
                                onMouseDown={keepFocus}
                                onClick={() => write(quantity + step)}
                                className="whitespace-nowrap rounded-lg border-[1.5px] border-dashed border-emerald-300 bg-white px-2.5 py-1.5 text-[11.8px] font-bold text-emerald-700 hover:border-solid hover:bg-emerald-50"
                            >
                                +1 set
                            </button>
                        )}
                    </div>
                );
            })}

            <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white/50 px-3.5 py-2.5">
                <span className="text-[12.8px] text-[#1E1B4B]/55">
                    {total > 0
                        ? <><b className="text-[#1E1B4B]">{total} pcs</b> · {colours} colour{colours > 1 ? "s" : ""} · {inr(total * design.unitPrice)}</>
                        : "Type pieces for the colours the customer wants."}
                </span>
                <div className="ml-auto flex gap-2">
                    <button
                        type="button"
                        onClick={clearAll}
                        className="neu-button rounded-full px-3.5 py-1.5 text-xs font-semibold text-[#1E1B4B]"
                    >
                        Clear
                    </button>
                    <button
                        type="button"
                        onClick={commit}
                        className="flex items-center gap-1.5 rounded-full bg-[#00694C] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#00563e]"
                    >
                        <Check className="h-3.5 w-3.5" />
                        {hasExisting ? "Update order" : "Add to order"}
                    </button>
                </div>
            </div>
        </div>
    );
});

// What shows under the finder's search box: quick-pick chips before anything is typed, "no match"
// when nothing fits, otherwise the matching designs (left) and the chosen design's colours (right).
export const DesignFinderResults = ({
    query, searching, noMatch, quickPicks, designs, chosen, lines, drafts, paneRef,
    onSelect, onQuickPick, onDraft, onCommit, onEscape,
}) => {
    if (!query.trim()) {
        if (quickPicks.length === 0) return null;

        return (
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-0.5 text-[11.5px] text-[#1E1B4B]/45">Quick pick:</span>
                {quickPicks.map((design) => (
                    <button
                        key={design.designId}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => onQuickPick(design.designCode)}
                        className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-emerald-500 hover:bg-emerald-50"
                    >
                        <b className="font-mono">{design.designCode}</b>
                        <em className="text-[11.5px] font-medium not-italic text-slate-500">{design.itemName ?? design.pattern}</em>
                    </button>
                ))}
            </div>
        );
    }

    if (searching && designs.length === 0) {
        return <p className="py-3 text-center text-[12.5px] text-[#1E1B4B]/45">Searching…</p>;
    }

    if (noMatch) {
        return (
            <div className="rounded-xl border-[1.5px] border-dashed border-slate-300 px-4 py-4 text-center text-[13px] leading-relaxed text-[#1E1B4B]/55">
                No design matches <b className="text-[#1E1B4B]">&ldquo;{query.trim()}&rdquo;</b>.
                <br />
                Check the design code, or try the item name, pattern or a colour.
            </div>
        );
    }

    if (designs.length === 0 || !chosen) return null;

    return (
        <div className="grid grid-cols-1 items-start gap-3.5 md:grid-cols-[minmax(220px,290px)_minmax(0,1fr)]">
            <div className="max-h-[440px] overflow-y-auto rounded-xl border border-white/60 bg-white/40 p-1.5">
                <div className="flex justify-between px-1.5 pb-1.5 pt-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#1E1B4B]/45">
                    <span>{designs.length} design{designs.length > 1 ? "s" : ""}</span>
                    <span>Stock</span>
                </div>

                {designs.map((design) => {
                    const inOrder = lines.filter((line) => line.designId === design.designId).reduce((sum, line) => sum + line.quantityPcs, 0);

                    return (
                        <button
                            key={design.designId}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => onSelect(design)}
                            className={cn(
                                "mb-0.5 flex w-full flex-col gap-0.5 rounded-lg border-[1.5px] border-transparent px-2.5 py-2 text-left text-[#1E1B4B] hover:bg-white",
                                design.designId === chosen.designId && "border-emerald-500 bg-white shadow-sm",
                            )}
                        >
                            <span className="flex items-center justify-between gap-2 text-sm">
                                <b className="font-mono"><MarkedCode code={design.designCode} query={query} /></b>
                                {inOrder > 0 && (
                                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2 py-px text-[10.5px] font-bold text-emerald-700">
                                        <Check className="h-2.5 w-2.5" />{inOrder} in order
                                    </span>
                                )}
                            </span>
                            <span className="truncate text-xs text-[#1E1B4B]/55">{designLabel(design)}</span>
                            <span className="mt-1 flex items-center gap-1">
                                {design.variants.map((variant) => (
                                    <span
                                        key={variant.colorVariantId}
                                        title={variant.colorName}
                                        className="h-2.5 w-2.5 rounded-full"
                                        style={{ background: variant.colorHex, boxShadow: "0 0 0 1.5px #fff, 0 0 0 2.5px #e2e8f0" }}
                                    />
                                ))}
                                <em className="ml-auto whitespace-nowrap text-[11.3px] not-italic text-slate-400">
                                    {design.variants.length} colour{design.variants.length > 1 ? "s" : ""} · {design.totalAvailablePcs} pcs
                                </em>
                            </span>
                        </button>
                    );
                })}
            </div>

            <VariantPane
                key={chosen.designId}
                ref={paneRef}
                design={chosen}
                drafts={drafts[chosen.designId] ?? {}}
                onDraft={(variantId, value) => onDraft(chosen.designId, variantId, value)}
                existing={existingFor(lines, chosen.designId)}
                focusVariantId={chosen.focusColorVariantId}
                onCommit={(quantities) => onCommit(chosen, quantities)}
                onEscape={onEscape}
            />
        </div>
    );
};
