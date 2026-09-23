import { cn } from "@/lib/utils";
import { formatAge } from "../../utils/currentStock";

export const Sheet = ({ className, children }) => (
  <section
    className={cn("rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] md:p-7", className)}
  >
    {children}
  </section>
);

export const Eyebrow = ({ className, children }) => (
  <div className={cn("text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400", className)}>{children}</div>
);

export const ColorDot = ({ hex, className }) => (
  <span
    className={cn("inline-block size-2.5 flex-none rounded-full ring-1 ring-slate-200", className)}
    style={{ backgroundColor: hex || "#CBD5E1" }}
  />
);

const PILL_TONES = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
  red: "border-red-200 bg-red-50 text-red-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
  neutral: "border-slate-200 bg-slate-100 text-slate-500",
};

export const Pill = ({ tone = "neutral", className, children }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
      PILL_TONES[tone],
      className,
    )}
  >
    {children}
  </span>
);

export const StatusPill = ({ variant }) => {
  if (variant.status === "OUT_OF_STOCK") return <Pill tone="red">Out of stock</Pill>;
  if (variant.status === "LOW") {
    return (
      <Pill tone="warn">
        Low · {variant.totalPieces} ≤ {variant.lowStockLevel}
      </Pill>
    );
  }
  return <Pill tone="ok">In stock</Pill>;
};

// Zero of a size is red (can't make a set), 1–2 amber (running out), otherwise neutral.
const sizeTone = (quantity) =>
  quantity === 0
    ? "border-red-200 bg-red-50 text-red-700"
    : quantity <= 2
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-slate-200 bg-white text-slate-700";

export const SizeChips = ({ sizes }) => (
  <div className="flex flex-wrap gap-1">
    {sizes.map((size) => (
      <span
        key={size.size}
        className={cn("min-w-[34px] rounded-md border px-1.5 py-0.5 text-center font-mono text-[10.8px]", sizeTone(size.quantity))}
      >
        <b className="block font-sans text-[8.8px] font-bold opacity-70">{size.size}</b>
        {size.quantity}
      </span>
    ))}
  </div>
);

export const AgeCell = ({ pieces, days, ageing }) =>
  pieces ? (
    <span className={cn("font-mono text-xs", ageing ? "font-bold text-violet-700" : "text-slate-600")}>{formatAge(days)}</span>
  ) : (
    <span className="text-slate-400">—</span>
  );

export const Num = ({ className, children }) => (
  <span className={cn("font-mono tabular-nums text-slate-600", className)}>{children}</span>
);
