import { Badge } from "@/components/ui/badge";

// One distinct stock-group composition currently held by this variant — count, recipe (as size×qty
// chips), and the physical pieces it represents. All values come straight from the detail API's
// `compositions[]`; only the "Composition 0N" ordinal is a frontend-assigned display label.
// In the Total scope, each composition is also tagged with the variant it belongs to (see
// currentStock.service.js's _buildTotalStockDetail) — bundle compositions are inherently
// variant-specific and are never merged across colors, so that tag is shown here instead.
const BundleCompositionCard = ({ index, composition }) => {
  const { bundleCount, composition: pieces, piecesPerBundle, totalPieces, colorName, colorHex } = composition;

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-muted/10 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          Composition {String(index + 1).padStart(2, "0")}
        </span>
        <div className="flex items-center gap-2">
          {colorName && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <span
                className="size-2 shrink-0 rounded-full border border-black/10"
                style={{ backgroundColor: colorHex }}
              />
              {colorName}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {bundleCount} bundle{bundleCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {pieces.map((piece) => (
          <Badge key={piece.designSizeId} variant="outline">
            {piece.size} × {piece.quantity}
          </Badge>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
        <span>{piecesPerBundle} pcs / bundle</span>
        <span className="font-medium text-foreground">{totalPieces} total pieces</span>
      </div>
    </div>
  );
};

export default BundleCompositionCard;
