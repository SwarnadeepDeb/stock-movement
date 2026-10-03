import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { hasPrice, priceBad, priceLabel } from "../../utils/galleryFilters.js";

// Price-per-piece range. Quick presets are derived from the prices actually on screen, so they
// are always useful whatever the catalogue holds.
const PricePopover = ({ items, filters, onChange, matchCount }) => {
    const [open, setOpen] = useState(false);

    const prices = items.map((item) => Number(item.unitPrice ?? 0));
    const lo = prices.length ? Math.min(...prices) : 0;
    const hi = prices.length ? Math.max(...prices) : 0;
    const step = Math.max(50, Math.round((hi - lo) / 3 / 50) * 50);
    const a = Math.floor(lo / 50) * 50 + step;
    const b = a + step;
    const presets = [
        ["", String(a), `Under ₹${a}`],
        [String(a), String(b), `₹${a} – ₹${b}`],
        [String(b), "", `₹${b} and above`],
    ];

    const active = hasPrice(filters);
    const bad = priceBad(filters);
    const set = (patch) => onChange({ ...filters, ...patch });
    const clean = (value) => (value === "" ? "" : String(Math.max(0, Number(value))));

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                type="button"
                className={cn(
                    "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[9px] border-[1.5px] px-3 py-2 text-[13px] font-semibold transition-colors max-sm:min-h-9 max-sm:px-2.5 max-sm:py-1.5 max-sm:text-[12.5px]",
                    bad ? "border-red-600 bg-red-50 text-red-600"
                        : active ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                            : "border-slate-300 bg-white text-slate-700 hover:border-emerald-200",
                )}
            >
                {active && !bad ? priceLabel(filters) : "Price"}
                <ChevronDown className="h-3 w-3 text-slate-400" />
            </PopoverTrigger>

            <PopoverContent align="start" className="w-72 gap-2 bg-white p-2.5 font-sans">
                <div className="flex items-end gap-2">
                    <label className="flex flex-1 flex-col gap-1 text-[11.5px] font-semibold text-slate-500">
                        Min ₹
                        <input
                            autoFocus
                            type="number"
                            min="0"
                            inputMode="numeric"
                            placeholder={String(lo)}
                            value={filters.pmin}
                            onChange={(event) => set({ pmin: clean(event.target.value) })}
                            className="w-full rounded-lg border-[1.5px] border-slate-300 px-2.5 py-2 font-mono text-sm outline-none focus:border-emerald-500"
                        />
                    </label>
                    <span className="pb-2.5 text-slate-400">–</span>
                    <label className="flex flex-1 flex-col gap-1 text-[11.5px] font-semibold text-slate-500">
                        Max ₹
                        <input
                            type="number"
                            min="0"
                            inputMode="numeric"
                            placeholder={String(hi)}
                            value={filters.pmax}
                            onChange={(event) => set({ pmax: clean(event.target.value) })}
                            onKeyDown={(event) => { if (event.key === "Enter") setOpen(false); }}
                            className="w-full rounded-lg border-[1.5px] border-slate-300 px-2.5 py-2 font-mono text-sm outline-none focus:border-emerald-500"
                        />
                    </label>
                </div>

                <p className="my-1 text-[11.8px] text-slate-500">
                    {bad
                        ? <span className="text-red-600">Min is more than max — fix the range to apply it.</span>
                        : <>Prices here: ₹{lo} – ₹{hi} per piece · <b>{matchCount}</b> variant{matchCount === 1 ? "" : "s"} match</>}
                </p>

                <div className="flex flex-wrap gap-1.5">
                    {presets.map(([min, max, label]) => (
                        <button
                            key={label}
                            type="button"
                            onClick={() => set({ pmin: min, pmax: max })}
                            className="rounded-lg border-[1.5px] border-slate-300 bg-white px-2.5 py-1.5 font-mono text-[11.6px] font-semibold text-slate-700 hover:border-emerald-600"
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3 border-t border-slate-100 px-1 pt-2">
                    <button type="button" onClick={() => set({ pmin: "", pmax: "" })} className="text-xs font-semibold text-slate-500 hover:underline">Clear</button>
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="ml-auto rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                        Done
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default PricePopover;
