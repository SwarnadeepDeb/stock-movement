import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getBundlePiecesPerBundle, getBundleTotalPieces } from "../utils/stockCalculations";

// One partial bundle's compact row — tap to edit, X to remove. No form logic here.
const BundleSummary = ({ bundle, index, onEdit, onRemove }) => {
  const piecesPerBundle = getBundlePiecesPerBundle(bundle.composition);
  const totalPieces = getBundleTotalPieces(bundle);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-2.5">
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left active:opacity-70"
      >
        <span className="text-sm font-medium text-foreground">Bundle #{index + 1}</span>
        <span className="text-xs text-muted-foreground">
          {bundle.quantity} bundles · {piecesPerBundle} pcs/bundle · {totalPieces} pcs
        </span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-muted-foreground"
        onClick={onRemove}
        aria-label={`Remove bundle ${index + 1}`}
      >
        <XIcon />
      </Button>
    </div>
  );
};

export default BundleSummary;
