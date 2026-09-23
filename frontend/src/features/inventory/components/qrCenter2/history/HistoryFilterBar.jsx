import { cn } from "@/lib/utils";
import DesignFilterCombobox from "../search/DesignFilterCombobox.jsx";
import { FilterRow, FilterSelect, ClearFiltersButton, ResultCount } from "../shared/primitives.jsx";

const STATUS_TABS = [
    { value: "all", label: "All" },
    { value: "pending", label: "Not printed" },
    { value: "partial", label: "Partially printed" },
    { value: "done", label: "Fully printed" },
];

export default function HistoryFilterBar({ designs, filters, onChange, onClear, statusFilter, onStatusChange, resultCount }) {
    const selectedDesign = designs.find((d) => String(d.id) === String(filters.designId));
    const variants = selectedDesign?.colorVariants ?? [];

    return (
        <>
            <FilterRow>
                <div className="col-span-2 sm:col-span-1">
                    <DesignFilterCombobox
                        designs={designs}
                        value={filters.designId}
                        onChange={(designId) => onChange({ ...filters, designId, colorVariantId: "" })}
                    />
                </div>
                <FilterSelect value={filters.colorVariantId} onChange={(e) => onChange({ ...filters, colorVariantId: e.target.value })} disabled={!selectedDesign} aria-label="Variant">
                    <option value="">All variants</option>
                    {variants.map((v) => <option key={v.id} value={v.id}>{v.colorName}</option>)}
                </FilterSelect>
                <FilterSelect value={filters.sort} onChange={(e) => onChange({ ...filters, sort: e.target.value })} aria-label="Sort">
                    <option value="new">Newest first</option>
                    <option value="old">Oldest first</option>
                    <option value="tags">Most tags</option>
                </FilterSelect>
                <ClearFiltersButton onClick={onClear} />
                <ResultCount>{resultCount} {resultCount === 1 ? "batch" : "batches"}</ResultCount>
            </FilterRow>

            {/* Segmented status tabs — 2×2 on phones, one row from sm up. */}
            <div className="mt-3 grid w-full grid-cols-2 gap-0.5 rounded-[9px] border border-slate-200 bg-slate-100 p-[3px] sm:inline-flex sm:w-auto sm:flex-wrap">
                {STATUS_TABS.map((t) => (
                    <button
                        key={t.value}
                        type="button"
                        onClick={() => onStatusChange(t.value)}
                        className={cn(
                            "rounded-[7px] px-3.5 py-1.5 text-[12.8px] font-semibold",
                            statusFilter === t.value ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,.1)]" : "text-slate-500",
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
        </>
    );
}
