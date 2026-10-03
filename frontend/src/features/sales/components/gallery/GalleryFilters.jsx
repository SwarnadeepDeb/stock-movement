import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FACETS, STOCK_OPTIONS, activeChips, facetOptions, freshFilters } from "../../utils/galleryFilters.js";
import FacetPopover from "./FacetPopover.jsx";
import PricePopover from "./PricePopover.jsx";

// Search + Designs / Item name / Pattern / Quality / Price filters, the stock toggle (All designs
// only), a "12 of 40" count and removable chips. One row on desktop; on a phone the filter buttons
// become a single swipeable strip so the photos stay close to the top.
const GalleryFilters = ({ items, filters, onChange, mode, matches, visibleCount }) => {
    const set = (patch) => onChange({ ...filters, ...patch });
    const chips = activeChips(items, filters, mode);
    // How many variants would remain if the price filter were ignored — shown inside the price panel.
    const priceMatchCount = items.filter((item) => matches(item)).length;

    const removeChip = (chip) => {
        if (chip.kind === "facet") set({ [chip.facetId]: filters[chip.facetId].filter((value) => value !== chip.value) });
        else if (chip.kind === "price") set({ pmin: "", pmax: "" });
        else if (chip.kind === "search") set({ q: "" });
        else set({ stock: "all" });
    };

    return (
        <div>
            <div className="flex flex-wrap items-center gap-2.5 max-sm:gap-2">
                <div className="relative min-w-[240px] flex-[1_1_300px] max-sm:min-w-0 max-sm:basis-full">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-emerald-600" />
                    <input
                        value={filters.q}
                        onChange={(event) => set({ q: event.target.value })}
                        autoComplete="off"
                        placeholder="Search by design code, item name, pattern, quality or colour"
                        className="w-full rounded-[13px] border-[1.5px] border-emerald-200 bg-emerald-50 py-2.5 pl-[42px] pr-3.5 font-mono text-[13.5px] text-slate-900 outline-none focus:border-emerald-500 max-sm:py-2"
                    />
                </div>

                <div className="flex flex-[1_1_auto] flex-wrap items-center gap-2 max-sm:basis-full max-sm:flex-nowrap max-sm:gap-1.5 max-sm:overflow-x-auto max-sm:pb-0.5 max-sm:[scrollbar-width:none]">
                    {FACETS.map((facet) => (
                        <FacetPopover
                            key={facet.id}
                            facet={facet}
                            options={facetOptions(items, filters, facet.id, matches)}
                            selected={filters[facet.id]}
                            onChange={(values) => set({ [facet.id]: values })}
                        />
                    ))}

                    <PricePopover items={items} filters={filters} onChange={onChange} matchCount={priceMatchCount} />

                    {mode === "all" && (
                        <div className="inline-flex shrink-0 gap-0.5 rounded-[10px] border border-slate-200 bg-slate-100 p-[3px]">
                            {STOCK_OPTIONS.map(([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => set({ stock: key })}
                                    className={cn(
                                        "whitespace-nowrap rounded-[7px] px-3.5 py-1.5 text-[12.6px] font-semibold",
                                        filters.stock === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500",
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}

                    <span className="ml-auto shrink-0 whitespace-nowrap text-[12.5px] text-slate-400 max-sm:ml-1 max-sm:text-[11.5px]">
                        {visibleCount} of {items.length} variant{items.length === 1 ? "" : "s"}
                    </span>
                </div>
            </div>

            {chips.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {chips.map((chip) => (
                        <span
                            key={`${chip.kind}-${chip.facetId ?? ""}-${chip.value ?? ""}`}
                            className={cn(
                                "flex items-center gap-1.5 rounded-full border py-[5px] pl-[11px] pr-1.5 text-xs font-semibold",
                                chip.bad ? "border-red-200 bg-red-50 text-red-600" : "border-emerald-200 bg-emerald-50 text-emerald-800",
                            )}
                        >
                            {chip.label}
                            <button
                                type="button"
                                onClick={() => removeChip(chip)}
                                aria-label={`Remove filter ${chip.label}`}
                                className="grid h-5 w-5 place-items-center rounded-full bg-white/70"
                            >
                                <X className="h-2.5 w-2.5" />
                            </button>
                        </span>
                    ))}
                    <button
                        type="button"
                        onClick={() => onChange(freshFilters())}
                        className="px-1.5 text-[13px] text-slate-500 hover:text-slate-900"
                    >
                        Clear all
                    </button>
                </div>
            )}
        </div>
    );
};

export default GalleryFilters;
