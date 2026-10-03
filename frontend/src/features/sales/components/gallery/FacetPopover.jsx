import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { codeKey } from "../../utils/galleryFilters.js";

// One multi-select filter (Designs, Item name, Pattern, Quality) as a button that opens a
// checklist. Each option carries the count it would leave on screen given the other filters.
const FacetPopover = ({ facet, options, selected, onChange }) => {
    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState("");

    const isDesigns = facet.id === "designs";
    const searchable = isDesigns || options.length > 6;
    const needle = term.trim().toLowerCase();

    // Designs match on the start of the code ("FL" → FL1, FL2), the rest on any part of the text.
    const shown = !needle ? options : options.filter((option) => (isDesigns
        ? codeKey(option.label).startsWith(codeKey(needle))
        : String(option.label).toLowerCase().includes(needle)));

    const toggle = (value) => onChange(selected.includes(value)
        ? selected.filter((candidate) => candidate !== value)
        : [...selected, value]);

    const selectShown = () => onChange([...new Set([...selected, ...shown.map((option) => option.value)])]);

    return (
        <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setTerm(""); }}>
            <PopoverTrigger
                type="button"
                className={cn(
                    "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[9px] border-[1.5px] px-3 py-2 text-[13px] font-semibold transition-colors max-sm:min-h-9 max-sm:px-2.5 max-sm:py-1.5 max-sm:text-[12.5px]",
                    selected.length
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                        : "border-slate-300 bg-white text-slate-700 hover:border-emerald-200",
                )}
            >
                {facet.label}
                {selected.length > 0 && (
                    <span className="grid h-[19px] min-w-[19px] place-items-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-bold text-white">{selected.length}</span>
                )}
                <ChevronDown className="h-3 w-3 text-slate-400" />
            </PopoverTrigger>

            <PopoverContent align="start" className="w-72 gap-2 bg-white p-2 font-sans">
                {searchable && (
                    <input
                        autoFocus
                        value={term}
                        onChange={(event) => setTerm(event.target.value)}
                        placeholder={isDesigns ? "Type a code, e.g. FL" : `Search ${facet.label.toLowerCase()}…`}
                        aria-label={`Search ${facet.label.toLowerCase()}`}
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-emerald-400"
                    />
                )}

                <div className="max-h-64 overflow-y-auto">
                    {options.length === 0 ? (
                        <div className="px-2 py-3 text-xs text-[#1E1B4B]/50">No {facet.label.toLowerCase()} match the other filters.</div>
                    ) : shown.length === 0 ? (
                        <div className="px-2 py-3 text-xs text-[#1E1B4B]/50">
                            {isDesigns ? "No design code starts with that." : `No ${facet.label.toLowerCase()} match.`}
                        </div>
                    ) : shown.map((option) => {
                        const on = selected.includes(option.value);

                        return (
                            <button
                                key={option.value}
                                type="button"
                                role="checkbox"
                                aria-checked={on}
                                onClick={() => toggle(option.value)}
                                className={cn(
                                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50",
                                    !option.count && !on && "opacity-50",
                                )}
                            >
                                <span className={cn(
                                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                    on ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-transparent",
                                )}>
                                    <Check className="h-3 w-3" />
                                </span>
                                <span className="min-w-0 flex-1 truncate text-[#1E1B4B]">
                                    <span className={cn(isDesigns && "font-mono")}>{option.label}</span>
                                    {option.hint && <span className="ml-1.5 text-xs text-[#1E1B4B]/50">{option.hint}</span>}
                                </span>
                                <span className="text-xs tabular-nums text-[#1E1B4B]/45">{option.count}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-3 border-t border-slate-100 px-1 pt-2">
                    <button type="button" onClick={selectShown} className="text-xs font-semibold text-[#00694C] hover:underline">Select all</button>
                    <button type="button" onClick={() => onChange([])} className="text-xs font-semibold text-[#1E1B4B]/60 hover:underline">Clear</button>
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="ml-auto rounded-lg bg-[#00694C] px-3 py-1 text-xs font-semibold text-white hover:bg-[#00563e]"
                    >
                        Done
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default FacetPopover;
