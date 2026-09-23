import { useNavigate } from "react-router";

// One chip per Color Variant — same colored-dot pattern as the Design Master "Variants" column,
// plus the variant's own piece count (Current Stock's job is to surface quantities, not just
// which colors exist) and a click-through to that variant's existing detail page.
const CurrentStockVariantChip = ({ variant }) => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(`/current-stock/${variant.colorVariantId}`)}
      title={`${variant.colorName} · ${variant.totalPieces} pcs`}
      className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-muted/40 px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
    >
      <span
        className="size-2.5 shrink-0 rounded-full border border-black/10"
        style={{ backgroundColor: variant.colorHex }}
      />
      {variant.totalPieces}
    </button>
  );
};

export default CurrentStockVariantChip;
