import { cn } from "@/lib/utils";

// Building blocks shared by the QR Center components. Plain Tailwind palette classes only —
// index.css remaps slate/emerald/amber/… for dark mode, so nothing here needs a dark: variant.

export const Sheet = ({ className, children }) => (
    <section className={cn("rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,.04),0_10px_28px_rgba(15,23,42,.05)] sm:p-5 lg:px-8 lg:py-7", className)}>
        {children}
    </section>
);

const BUTTON_VARIANTS = {
    default: "border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
    primary: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
    dark: "border-slate-900 bg-slate-900 text-white hover:bg-slate-800",
};

const BUTTON_SIZES = {
    md: "rounded-[9px] px-4 py-2.5 text-[13.5px]",
    sm: "rounded-lg px-3 py-1.5 text-[12.5px]",
};

export const ActionButton = ({ variant = "default", size = "md", className, ...props }) => (
    <button
        type="button"
        className={cn(
            "inline-flex items-center justify-center gap-2 whitespace-nowrap border font-semibold disabled:cursor-not-allowed disabled:opacity-45",
            BUTTON_VARIANTS[variant],
            BUTTON_SIZES[size],
            className,
        )}
        {...props}
    />
);

const PILL_TONES = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-600",
    warn: "border-amber-200 bg-amber-50 text-amber-700",
    part: "border-blue-200 bg-blue-50 text-blue-700",
    neu: "border-slate-200 bg-slate-100 text-slate-500",
};

export const Pill = ({ tone = "neu", children }) => (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] font-semibold", PILL_TONES[tone])}>
        {children}
    </span>
);

const KIND_TONES = {
    SET: "bg-emerald-50 text-emerald-600",
    SEMI: "bg-violet-50 text-violet-700",
    BUNDLE: "bg-violet-50 text-violet-700",
    PIECE: "bg-blue-50 text-blue-700",
    LOOSE: "bg-amber-50 text-amber-700",
    LOOSE_PIECE: "bg-amber-50 text-amber-700",
    RETIRED: "bg-slate-100 text-slate-500",
};

export const KindBadge = ({ kind }) => (
    <span className={cn("flex-none rounded-[5px] px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[.06em]", KIND_TONES[kind])}>
        {kind}
    </span>
);

// Filter bar layout — phone: 2-column grid (put the design search in a col-span-2 cell);
// sm+: one wrapping row with the result count pushed right.
export const FilterRow = ({ className, children }) => (
    <div className={cn("mt-3 grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap sm:gap-2.5", className)}>{children}</div>
);

export const ClearFiltersButton = ({ onClick }) => (
    <button type="button" onClick={onClick} className="justify-self-start px-1.5 py-2 text-[13px] text-slate-500 hover:text-slate-900">
        Clear filters
    </button>
);

export const ResultCount = ({ children }) => (
    <span className="justify-self-end text-[12.8px] text-slate-400 sm:ml-auto">{children}</span>
);

// Native <select> with a drawn chevron — the filter bars' dropdown.
export const FilterSelect = ({ className, children, ...props }) => (
    <span className={cn("relative block sm:inline-block", className)}>
        <select
            className="w-full cursor-pointer appearance-none rounded-[9px] border border-slate-300 bg-white py-2.5 pr-8 pl-3 text-[13.3px] text-slate-700 outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 sm:py-2"
            {...props}
        >
            {children}
        </select>
        <span className="pointer-events-none absolute top-1/2 right-3 size-1.5 -translate-y-[70%] rotate-45 border-r-[1.6px] border-b-[1.6px] border-slate-400" />
    </span>
);

// Bordered list container (search results, history rows, child pieces).
// Pass to ListBox so a long list scrolls inside its box rather than stretching the page.
export const LIST_SCROLL = "max-h-[60vh] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(30,27,75,0.25)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#1E1B4B]/25 [&::-webkit-scrollbar-thumb:hover]:bg-[#1E1B4B]/40";

export const ListBox = ({ className, children }) => (
    <div className={cn("overflow-hidden rounded-[13px] border border-slate-200", className)}>{children}</div>
);

export const EmptyState = ({ title, children }) => (
    <div className="px-5 py-10 text-center text-sm text-slate-500">
        {title && <b className="mb-1 block text-[15px] text-slate-900">{title}</b>}
        {children}
    </div>
);

export const InfoNote = ({ className, children }) => (
    <div className={cn("border-t border-blue-200 bg-blue-50 px-3.5 py-3 text-[13.3px] leading-relaxed text-blue-800 sm:px-5", className)}>
        {children}
    </div>
);

export const SectionLabel = ({ children }) => (
    <div className="mb-2 text-[11px] font-bold uppercase tracking-[.08em] text-slate-400">{children}</div>
);
