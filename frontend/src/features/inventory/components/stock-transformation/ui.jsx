import { useEffect, useId, useRef } from "react";
import { AlertTriangle, Check, ScanLine, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { CUSTODY, agoText, pieceLabel } from "../../utils/stockTransformation";

// Small building blocks shared by the Stock Transformation tabs and flows.

const WHERE_TONES = {
  stock: "border-emerald-200 bg-emerald-50 text-emerald-700",
  inset: "border-slate-200 bg-slate-100 text-slate-700",
  display: "border-blue-200 bg-blue-50 text-blue-700",
  sales: "border-violet-200 bg-violet-50 text-violet-700",
  sample: "border-amber-200 bg-amber-50 text-amber-700",
  alter: "border-pink-200 bg-pink-50 text-pink-700",
  gone: "border-slate-200 bg-white text-slate-400 line-through",
};

const Chip = ({ tone, overdue, title, children }) => (
  <span
    title={title}
    className={cn(
      "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10.8px] font-bold tracking-[0.02em]",
      WHERE_TONES[tone],
      overdue && "ring-2 ring-red-500/25",
    )}
  >
    {children}
  </span>
);

// Where a piece is right now: in stock, inside a set, out with someone, or gone.
export const WhereChip = ({ piece }) => {
  if (piece.state === "GONE") return <Chip tone="gone">Sold / written off</Chip>;
  if (piece.state === "INSIDE") return <Chip tone="inset">In {piece.insideCode ?? `#${piece.insideUnitId}`}</Chip>;
  const custody = CUSTODY[piece.custody.type];
  if (piece.custody.type === "STOCK") return <Chip tone="stock">In stock</Chip>;
  return (
    <Chip tone={custody.tone} overdue={piece.custody.overdue} title={piece.custody.since ? `since ${new Date(piece.custody.since).toLocaleDateString()}` : undefined}>
      {custody.short}
      {piece.custody.holder ? ` · ${piece.custody.holder}` : ""} · {agoText(piece.custody.days)}
    </Chip>
  );
};

export const CustodyChip = ({ type }) => <Chip tone={CUSTODY[type].tone}>{CUSTODY[type].label}</Chip>;

// One size position of a set: the piece picked for it, where it is, and where it came from.
export const SizeSlot = ({ size, piece, tone = "ok", emptyText = "none loose" }) => {
  if (!piece) {
    return (
      <div className="min-w-[118px] flex-1 rounded-[11px] border border-dashed border-slate-300 bg-white px-3 py-2.5">
        <div className="text-[10.5px] font-bold text-slate-400">{size}</div>
        <div className="mt-1 font-mono text-[11.3px] text-slate-400">{emptyText}</div>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "min-w-[118px] flex-1 rounded-[11px] border px-3 py-2.5",
        tone === "ok" && "border-emerald-200 bg-emerald-50",
        tone === "out" && "border-violet-200 bg-violet-50",
        tone === "neutral" && "border-slate-200 bg-slate-50",
      )}
    >
      <div className="text-[10.5px] font-bold text-slate-400">{size}</div>
      <div className="mb-1.5 mt-0.5 break-all font-mono text-[11.3px] font-semibold text-slate-900">{pieceLabel(piece)}</div>
      <WhereChip piece={piece} />
      <div className="mt-1.5 text-[11px] text-slate-400">
        {piece.originCode ? `from ${piece.originCode}` : "loose from inward"}
        {piece.challanNo ? ` · ${piece.challanNo}` : ""}
      </div>
    </div>
  );
};

export const Feedback = ({ kind, children }) => {
  if (!children) return null;
  const Icon = kind === "ok" ? Check : AlertTriangle;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-[10px] border px-3 py-2.5 text-[12.8px] leading-relaxed",
        kind === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        kind === "bad" && "border-red-200 bg-red-50 text-red-800",
        kind === "warn" && "border-amber-200 bg-amber-50 text-amber-800",
      )}
    >
      <Icon className="mt-0.5 size-3.5 flex-none" strokeWidth={2.6} />
      <div>{children}</div>
    </div>
  );
};

// Scan box for a QR gun (types the code and presses Enter) or manual entry.
export const ScanInput = ({ placeholder, onScan, disabled, autoFocus = true }) => {
  const inputRef = useRef(null);
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div>
      <div className="relative">
        <ScanLine className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-emerald-600" />
        <input
          ref={inputRef}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={placeholder}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            const value = event.currentTarget.value.trim();
            if (value) onScan(value);
            event.currentTarget.value = "";
          }}
          className="w-full rounded-xl border-2 border-emerald-200 bg-emerald-50 py-3.5 pl-12 pr-4 font-mono text-[14.5px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500"
        />
      </div>
      <p className="mt-1.5 text-[11.8px] text-slate-400">
        Scan with the QR gun or type the tag ID and press <b>Enter</b>.
      </p>
    </div>
  );
};

// Free-text name with suggestions from names used before for this kind of custody.
export const HolderInput = ({ type, value, onChange, suggestions = [] }) => {
  const listId = useId();
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-[12.8px] text-slate-500">{CUSTODY[type].holderLabel}</span>
      <input
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={type === "ALTERATION" ? "e.g. Sagar Tailors" : "Type a name"}
        maxLength={150}
        className="min-w-[200px] rounded-lg border-[1.5px] border-slate-300 bg-white px-2.5 py-1.5 text-[12.6px] text-slate-900 outline-none focus:border-emerald-500"
      />
      <datalist id={listId}>
        {suggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
};

const PICKED_TONES = {
  STOCK: "border-emerald-600 bg-emerald-50 text-emerald-700",
  DISPLAY: "border-blue-600 bg-blue-50 text-blue-700",
  SALESPERSON: "border-violet-600 bg-violet-50 text-violet-700",
  SAMPLE: "border-amber-600 bg-amber-50 text-amber-700",
  ALTERATION: "border-pink-600 bg-pink-50 text-pink-700",
};

export const CustodyPicker = ({ value, onChange, options }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((type) => (
      <button
        key={type}
        type="button"
        onClick={() => onChange(type)}
        aria-pressed={value === type}
        className={cn(
          "rounded-full border-[1.5px] px-3 py-1.5 text-xs font-semibold transition-colors",
          value === type ? PICKED_TONES[type] : "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
        )}
      >
        {CUSTODY[type].short}
      </button>
    ))}
  </div>
);

// Full-screen overlay for Break / Form / Move — header, scrolling body, sticky footer.
export const FlowShell = ({ eyebrow, title, onClose, footer, children }) => {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event) => {
      if (event.key === "Escape" && !document.querySelector("[data-slot='dialog-content']")) onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[70] flex flex-col bg-slate-50">
      <div className="flex-none border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1340px] items-center gap-4 px-5 py-3.5 md:px-7">
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400">{eyebrow}</div>
            <div className="mt-0.5 text-[19px] font-bold text-slate-900">{title}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto grid size-[30px] place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1340px] flex-col gap-4 px-5 py-5 md:px-7">{children}</div>
      </div>
      <div className="flex-none border-t border-slate-200 bg-white shadow-[0_-6px_20px_rgba(15,23,42,0.05)]">
        <div className="mx-auto flex max-w-[1340px] flex-wrap items-center gap-3 px-5 py-3.5 md:px-7">{footer}</div>
      </div>
    </div>
  );
};
