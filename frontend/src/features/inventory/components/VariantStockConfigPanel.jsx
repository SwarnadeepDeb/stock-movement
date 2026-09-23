import { Loader2Icon } from "lucide-react";

import { useColorVariantSizesApi } from "../hooks/useColorVariantSizesApi";
import BundleList from "./BundleList";
import CompleteSetsInput from "./CompleteSetsInput";
import LoosePiecesSummary from "./LoosePiecesSummary";

const VariantStockConfigPanel = ({
  variant,
  config,
  onSetTotalSetsReceived,
  onAddBundle,
  onUpdateBundle,
  onRemoveBundle,
  onSetLoosePieces,
}) => {
  const { colorVariantId } = variant;

  const { data: response, isFetching, isError } = useColorVariantSizesApi({ colorVariantId });
  const sizes = response?.data ?? [];

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

      <CompleteSetsInput value={config.totalSetsReceived} onChange={onSetTotalSetsReceived} />

      <BundleList
        bundles={config.bundles}
        sizes={sizes}
        disabled={sizes.length === 0}
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

export default VariantStockConfigPanel;
