// Pure identity display for a selected variant — image, code/name, color. Used as the
// content of VariantStockCard's collapsible trigger, so it stays unopinionated about
// click handling or expanded/active styling; the wrapper owns that.
const SelectedVariantCard = ({ variant }) => {
  const { imageUrl, designCode, designName, colorName, colorHex } = variant;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={colorName}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate text-sm font-medium text-foreground">
          {designCode ? `${designCode} · ` : ""}
          {designName}
        </p>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          Color:
          <span
            className="size-2.5 shrink-0 rounded-full border border-black/10"
            style={{ backgroundColor: colorHex }}
          />
          {colorName}
        </span>
      </div>
    </div>
  );
};

export default SelectedVariantCard;
