import { useEffect } from "react";
import { Loader2Icon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useModal } from "@/components/shared/ModalProvider";
import SizeQuantityGrid from "../../components/SizeQuantityGrid";
import { useColorVariantSizesApi } from "../../hooks/useColorVariantSizesApi";
import { useVariantSemiSetsApi } from "../../hooks/useVariantSemiSetsApi";
import { getBundleTotalPieces, getLoosePiecesTotal } from "../../utils/stockCalculations";
import { getVariantKey } from "../../utils/variantKey";
import { getVariantDisplayCode } from "../../utils/variantDisplay";
import AddCustomSemiSetDialog from "./AddCustomSemiSetDialog";

const SetMatrixVariantCard = ({
  index,
  variant,
  config,
  onSetTotalSetsReceived,
  onSetLoosePieces,
  onAddBundle,
  onUpdateBundle,
  onRemoveBundle,
  onTotalsChange,
}) => {
  const key = getVariantKey(variant);
  const { openModal } = useModal();
  const { data: sizesResponse, isFetching, isError } = useColorVariantSizesApi({
    colorVariantId: variant.colorVariantId,
  });
  const sizes = sizesResponse?.data ?? [];

  const { data: semiSetsResponse } = useVariantSemiSetsApi({ colorVariantId: variant.colorVariantId });
  const semiSets = semiSetsResponse?.data ?? [];

  const setsTotal = config.totalSetsReceived || 0;
  const looseTotal = getLoosePiecesTotal(config.loosePieces);
  const semiSetsTotal = config.bundles.reduce((sum, bundle) => sum + (Number(bundle.quantity) || 0), 0);
  const bundlesTotal = config.bundles.reduce((sum, bundle) => sum + getBundleTotalPieces(bundle), 0);
  const piecesPerSet = sizes.length;
  const garmentsTotal = setsTotal * piecesPerSet + looseTotal + bundlesTotal;

  useEffect(() => {
    onTotalsChange(key, {
      variant,
      setsTotal,
      semiSetsTotal,
      looseTotal,
      bundlesTotal,
      garmentsTotal,
      piecesPerSet,
      sizeLabels: sizes.map((size) => size.sizeLabel),
      // Full id+label+includedInSet list — Tag Studio needs this to turn a bundle's
      // {designSizeId: qty} composition (see useVariantStockConfigs.js) into real size
      // labels for parent/semi tag copy, and to tell a full set apart from a semi set.
      sizes: sizes.map((size) => ({ id: size.id, sizeLabel: size.sizeLabel, includedInSet: size.includedInSet })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setsTotal, looseTotal, bundlesTotal, garmentsTotal, piecesPerSet, sizes.length]);

  const handleAddSemiSet = (semiSet) => {
    const composition = Object.fromEntries(semiSet.sizes.map((size) => [size.id, 1]));
    onAddBundle(key, { quantity: 1, composition, label: semiSet.label });
  };

  // Semi Sets configured in Design Master are still offered above, but adding one there is
  // no longer a prerequisite — the user can define a Semi Set for this transaction only.
  // It never touches Design Master; onAddBundle stores it the same way as a configured one.
  const handleAddCustomSemiSet = () => {
    openModal(AddCustomSemiSetDialog, {
      sizes,
      onSubmit: (bundle) => onAddBundle(key, bundle),
    });
  };

  const handleBundleQuantityChange = (bundle, event) => {
    const raw = event.target.value;
    const parsed = raw === "" ? 0 : parseInt(raw, 10);
    onUpdateBundle(key, bundle.localId, {
      quantity: Number.isNaN(parsed) || parsed < 0 ? 0 : parsed,
      composition: bundle.composition,
    });
  };

  const handleSetInputChange = (event) => {
    const raw = event.target.value;
    const parsed = raw === "" ? 0 : parseInt(raw, 10);
    onSetTotalSetsReceived(key, Number.isNaN(parsed) || parsed < 0 ? 0 : parsed);
  };

  const handleLooseChange = (sizeId, quantity) => {
    onSetLoosePieces(key, { ...config.loosePieces, [sizeId]: quantity });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300">
      <div className="mb-3 flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-2.5">
          <span
            className="size-4 shrink-0 rounded-full border shadow-sm"
            style={{ backgroundColor: variant.colorHex, borderColor: variant.colorHex }}
          />
          <span className="text-xs font-bold text-slate-900">
            Variant {index + 1}: {variant.colorName}
          </span>
          <span className="font-mono text-[11px] text-slate-400">({getVariantDisplayCode(variant)})</span>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor={`sets-${key}`} className="whitespace-nowrap text-xs font-bold text-slate-700">
            Sets Received
          </label>
          <Input
            id={`sets-${key}`}
            type="number"
            inputMode="numeric"
            min={0}
            value={setsTotal || ""}
            onChange={handleSetInputChange}
            className="h-[38px] w-24 rounded-lg border-2 border-slate-300 text-center text-sm font-bold text-slate-900 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/10"
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Semi Sets</p>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button type="button" variant="outline" size="sm">
                  <PlusIcon className="size-3.5" /> Add Semi Set
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {semiSets.map((semiSet) => (
                <DropdownMenuItem key={semiSet.id} onClick={() => handleAddSemiSet(semiSet)}>
                  {semiSet.label}
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    ({semiSet.sizes.map((size) => size.sizeLabel).join("/")})
                  </span>
                </DropdownMenuItem>
              ))}
              {semiSets.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={handleAddCustomSemiSet}>
                <PlusIcon className="size-3.5" /> Custom Semi Set…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {config.bundles.length === 0 ? (
          <span className="text-xs text-slate-400">No semi sets added for this variant.</span>
        ) : (
          <div className="space-y-2">
            {config.bundles.map((bundle) => (
              <div
                key={bundle.localId}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5"
              >
                <span className="text-xs font-semibold text-slate-800">
                  {bundle.label ?? "Semi Set"}{" "}
                  <span className="font-normal text-slate-500">
                    ({sizes.filter((size) => Number(bundle.composition?.[size.id]) > 0).map((size) => size.sizeLabel).join(", ")})
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={bundle.quantity || ""}
                    onChange={(event) => handleBundleQuantityChange(bundle, event)}
                    className="h-8 w-20 rounded-md border-slate-200 text-center text-xs font-bold text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveBundle(key, bundle.localId)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Loose Pieces
        </p>

        {isFetching && (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <Loader2Icon className="size-3.5 animate-spin" /> Loading active sizes...
          </span>
        )}
        {!isFetching && isError && (
          <span className="text-xs text-red-600">Failed to load active sizes for this variant.</span>
        )}
        {!isFetching && !isError && sizes.length === 0 && (
          <span className="text-xs text-slate-400">No active sizes configured for this variant.</span>
        )}
        {!isFetching && !isError && sizes.length > 0 && (
          <SizeQuantityGrid sizes={sizes} values={config.loosePieces} onChange={handleLooseChange} />
        )}
      </div>
    </div>
  );
};

export default SetMatrixVariantCard;
