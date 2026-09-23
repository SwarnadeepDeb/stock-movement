export const TOTAL_SCOPE = "TOTAL";

// Same selected/unselected pill treatment as StockTransformation's bundle-configuration selector
// (neu-button + accent border/text when active) — a single-select switch between one variant's
// stock and the design's aggregated Total, not a multi-select toggle.
const CurrentStockScopeSelector = ({ variants, selectedScope, onSelect }) => (
  <div className="flex flex-wrap items-center gap-2">
    {variants.map((variant) => {
      const isSelected = selectedScope === variant.colorVariantId;

      return (
        <button
          key={variant.colorVariantId}
          type="button"
          aria-pressed={isSelected}
          onClick={() => onSelect(variant.colorVariantId)}
          className={`neu-button inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
            isSelected ? "border-[#00694C] font-semibold text-[#00694C]" : "border-transparent text-foreground"
          }`}
        >
          <span
            className="size-2.5 shrink-0 rounded-full border border-black/10"
            style={{ backgroundColor: variant.colorHex }}
          />
          {variant.colorName}
        </button>
      );
    })}

    {/* Dashed border + no color dot when unselected keeps Total visually distinct from a color —
        it represents every variant combined, not one more choice alongside them. */}
    <button
      type="button"
      aria-pressed={selectedScope === TOTAL_SCOPE}
      onClick={() => onSelect(TOTAL_SCOPE)}
      className={`neu-button inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
        selectedScope === TOTAL_SCOPE
          ? "border-[#00694C] font-semibold text-[#00694C]"
          : "border-dashed border-border text-foreground"
      }`}
    >
      Total
    </button>
  </div>
);

export default CurrentStockScopeSelector;
