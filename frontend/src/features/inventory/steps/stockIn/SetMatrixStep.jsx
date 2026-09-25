import { useMemo } from "react";
import { Shirt } from "lucide-react";

import { getVariantKey } from "../../utils/variantKey";
import { useColorVariantSizesApi } from "../../hooks/useColorVariantSizesApi";
import SetMatrixVariantCard from "./SetMatrixVariantCard";

const formatInr = (amount) => `₹${Number(amount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Header for one design's block: its identity, the sizes that make one complete set, and the
// selling price base. Sizes come from the design's first selected variant.
const DesignHeader = ({ variants }) => {
  const primary = variants[0];
  const { data: sizesResponse } = useColorVariantSizesApi({ colorVariantId: primary.colorVariantId });
  const sizes = sizesResponse?.data ?? [];
  const price = primary.sellingPricePerPiece ?? 0;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-300 bg-slate-200">
          <div className="text-center">
            <Shirt className="mx-auto size-6 text-slate-400" />
            <span className="text-[9px] font-medium text-slate-500">{primary.designCode}</span>
          </div>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              {primary.designName} ({primary.designCode})
            </h3>
            {sizes.length > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                {sizes.length}-Piece Set: {sizes.map((size) => size.sizeLabel).join(", ")}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">Enter completed bundles and individual loose garments received.</p>
        </div>
      </div>
      <div className="text-right">
        <span className="block text-[11px] text-slate-500">Selling Price Base</span>
        <span className="text-xs font-bold text-slate-800">
          {formatInr(price)} / Pc
        </span>
      </div>
    </div>
  );
};

const SetMatrixStep = ({
  selectedVariants,
  configs,
  onSetTotalSetsReceived,
  onSetLoosePieces,
  onAddBundle,
  onUpdateBundle,
  onRemoveBundle,
  variantTotals,
  onVariantTotalsChange,
  error,
}) => {
  const designs = useMemo(() => {
    const groups = new Map();
    for (const variant of selectedVariants) {
      groups.set(variant.designId, [...(groups.get(variant.designId) ?? []), variant]);
    }
    return [...groups.values()];
  }, [selectedVariants]);

  const totalsList = Object.values(variantTotals);
  const grandSets = totalsList.reduce((sum, item) => sum + item.setsTotal, 0);
  const grandSemiSets = totalsList.reduce((sum, item) => sum + (item.semiSetsTotal || 0), 0);
  const grandLoose = totalsList.reduce((sum, item) => sum + item.looseTotal, 0);
  const grandSemiPcs = totalsList.reduce((sum, item) => sum + (item.bundlesTotal || 0), 0);
  const grandSetPcs = totalsList.reduce((sum, item) => sum + item.setsTotal * item.piecesPerSet, 0);
  const grandGarments = totalsList.reduce((sum, item) => sum + item.garmentsTotal, 0);

  if (selectedVariants.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
        No variants added yet. Go back to Inward Details and search for a design to add colour variants.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {designs.map((variants) => (
        <div key={variants[0].designId} className="space-y-4">
          <DesignHeader variants={variants} />
          {variants.map((variant, index) => {
            const key = getVariantKey(variant);
            const config = configs[key];
            if (!config) return null;

            return (
              <SetMatrixVariantCard
                key={key}
                index={index}
                variant={variant}
                config={config}
                onSetTotalSetsReceived={onSetTotalSetsReceived}
                onSetLoosePieces={onSetLoosePieces}
                onAddBundle={onAddBundle}
                onUpdateBundle={onUpdateBundle}
                onRemoveBundle={onRemoveBundle}
                onTotalsChange={onVariantTotalsChange}
              />
            );
          })}
        </div>
      ))}

      {error && <div className="text-xs text-red-600">{error}</div>}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
        <div className="flex flex-wrap items-center gap-6 text-xs">
          <div>
            <span className="block font-medium text-emerald-700">Total Complete Sets:</span>
            <span className="text-base font-bold text-emerald-900">{grandSets} Sets</span>
          </div>
          <div className="border-l border-emerald-200 pl-6">
            <span className="block font-medium text-emerald-700">Total Semi Sets:</span>
            <span className="text-base font-bold text-emerald-900">{grandSemiSets} Sets</span>
          </div>
          <div className="border-l border-emerald-200 pl-6">
            <span className="block font-medium text-emerald-700">Total Loose Pieces:</span>
            <span className="text-base font-bold text-emerald-900">{grandLoose} Pcs</span>
          </div>
          <div className="border-l border-emerald-200 pl-6">
            <span className="block font-medium text-emerald-700">Combined Total Garments:</span>
            <span className="text-base font-bold text-emerald-900">{grandGarments} Pcs</span>
          </div>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800">
          Formula: {grandSetPcs} set pcs + {grandSemiPcs} semi set pcs + {grandLoose} loose = {grandGarments} Pcs
        </div>
      </div>
    </div>
  );
};

export default SetMatrixStep;
