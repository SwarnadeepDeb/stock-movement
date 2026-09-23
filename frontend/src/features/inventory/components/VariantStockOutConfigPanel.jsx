import { Loader2Icon } from "lucide-react";

import { useColorVariantSizesApi } from "../hooks/useColorVariantSizesApi";
import { useCurrentStockDetailApi } from "../hooks/useCurrentStockDetailApi";
import BundlesSoldSummary from "./BundlesSoldSummary";
import CompleteSetsInput from "./CompleteSetsInput";
import LoosePiecesSummary from "./LoosePiecesSummary";

// Same shell as Stock In's VariantStockConfigPanel — "Sizes: ...", a sets field, "+ Add
// Bundle", "+ Add Loose Pieces" — just "Sets received" becomes "Sets Out". Bundles are the one
// necessary difference: Stock In composes a brand-new bundle recipe on receipt, but Stock Out
// can only sell a composition that's already assembled and in stock, so its dialog picks from
// existing compositions (via Current Stock Detail) instead of freely defining one.
const VariantStockOutConfigPanel = ({
  variant,
  config,
  onSetTotalSetsSold,
  onAddBundle,
  onUpdateBundle,
  onRemoveBundle,
  onSetLoosePieces,
}) => {
  const { colorVariantId } = variant;

  const { data: sizesResponse, isFetching, isError } = useColorVariantSizesApi({ colorVariantId });
  const sizes = sizesResponse?.data ?? [];

  const { data: stockResponse } = useCurrentStockDetailApi(colorVariantId);
  const compositions = stockResponse?.data?.compositions ?? [];

  return (
    <div className="flex flex-col gap-4 border-t border-border p-3 sm:p-4">
      <p className="text-xs text-muted-foreground">
        {isFetching && (
          <span className="inline-flex items-center gap-1.5">
            <Loader2Icon className="size-3.5 animate-spin" />
            Loading active sizes...
          </span>
        )}
        {!isFetching && isError && "Failed to load active sizes for this variant."}
        {!isFetching && !isError && (
          sizes.length > 0
            ? `Sizes: ${sizes.map((size) => size.sizeLabel).join(", ")}`
            : "No active sizes configured for this variant."
        )}
      </p>

      <CompleteSetsInput
        id="total-sets-out"
        label="Sets Out"
        value={config.totalSetsSold}
        onChange={onSetTotalSetsSold}
      />

      <BundlesSoldSummary
        bundles={config.bundles}
        compositions={compositions}
        disabled={compositions.length === 0}
        onAdd={onAddBundle}
        onUpdate={onUpdateBundle}
        onRemove={onRemoveBundle}
      />

      <LoosePiecesSummary
        loosePieces={config.loosePieces}
        sizes={sizes}
        disabled={sizes.length === 0}
        onChange={onSetLoosePieces}
      />
    </div>
  );
};

export default VariantStockOutConfigPanel;
