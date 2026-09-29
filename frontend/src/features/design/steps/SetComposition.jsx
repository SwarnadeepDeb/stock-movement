import { Fragment, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Check, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { sortSizes } from "../utils/sizeOrder";
import { sizesRules } from "../utils/setCompositionRules";

const DEFAULT_SIZES = ["S", "M", "L", "XL", "XXL"];

// Semi sets are named sub-compositions of the full set above (e.g. "3-pc: S/M/L") — jobbers
// sometimes deliver these instead of a complete set. Kept as a second, sibling Controller so
// its own array shape (label + sizeLabels) doesn't have to live inside the `sizes` field.
const SemiSetsField = ({ control, selectedSizes }) => (
  <Controller
    control={control}
    name="semiSets"
    defaultValue={[]}
    render={({ field }) => {
      const semiSets = field.value ?? [];

      const addSemiSet = () => {
        field.onChange([...semiSets, { label: "", sizeLabels: [] }]);
      };

      const removeSemiSet = (index) => {
        field.onChange(semiSets.filter((_, i) => i !== index));
      };

      const updateSemiSet = (index, patch) => {
        field.onChange(semiSets.map((semiSet, i) => (i === index ? { ...semiSet, ...patch } : semiSet)));
      };

      const toggleSemiSetSize = (index, size) => {
        const semiSet = semiSets[index];
        // Kept smallest → largest regardless of click order (see sortSizes).
        const sizeLabels = sortSizes(
          semiSet.sizeLabels.includes(size)
            ? semiSet.sizeLabels.filter((s) => s !== size)
            : [...semiSet.sizeLabels, size]
        );
        updateSemiSet(index, { sizeLabels });
      };

      return (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Semi Sets (optional)</h3>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={addSemiSet}
              disabled={selectedSizes.length === 0}
              className="hover:!bg-[#00694C] hover:!text-white"
            >
              <Plus className="size-4" /> Add Semi Set
            </Button>
          </div>

          {semiSets.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Define a smaller, named sub-composition (e.g. "3-pc: S/M/L") for jobbers who sometimes deliver
              partial sets instead of the full set above.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {semiSets.map((semiSet, index) => (
                <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Input
                      value={semiSet.label}
                      onChange={(e) => updateSemiSet(index, { label: e.target.value })}
                      placeholder='e.g. "3-pc: S/M/L"'
                      className="h-9 flex-1 bg-white text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeSemiSet(index)}
                      className="neu-icon-button text-muted-foreground hover:text-red-600"
                      aria-label="Remove semi set"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {selectedSizes.map((size) => {
                      const isSelected = semiSet.sizeLabels.includes(size);

                      return (
                        <Button
                          key={size}
                          type="button"
                          onClick={() => toggleSemiSetSize(index, size)}
                          className={cn(
                            "flex h-8 items-center gap-1 rounded-full neu-button border px-3 text-xs font-medium transition-colors",
                            isSelected
                              ? "border-[#00694C]! bg-[#00694C]! text-[#ffffff]"
                              : "border-transparent! text-muted-foreground hover:bg-muted/70!"
                          )}
                        >
                          {isSelected && <Check className="size-3" />}
                          {size}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }}
  />
);

const SetCompositionFields = ({ control }) => {
  const { getValues } = useFormContext();
  // When editing, a design may already use sizes outside the defaults (e.g. "Free Size") —
  // they have to be listed to stay selected.
  const [customSizes, setCustomSizes] = useState(() => (getValues("sizes") ?? []).filter((size) => !DEFAULT_SIZES.includes(size)));
  const [isAddingCustomSize, setIsAddingCustomSize] = useState(false);
  const [customSizeValue, setCustomSizeValue] = useState("");

  const allSizes = sortSizes([...DEFAULT_SIZES, ...customSizes]);

  return (
    <Controller
      control={control}
      name="sizes"
      defaultValue={[]}
      // Blocks leaving this step (Next or the stepper header — see useDesignWizard) until the set
      // has at least one size.
      rules={sizesRules}
      render={({ field, fieldState }) => {
        // Always smallest → largest (S-M-L-XL), whatever order the sizes were clicked in — also
        // straightens out older designs saved in click order when they're opened for editing.
        const selectedSizes = sortSizes(field.value ?? []);

        const toggleSize = (size) => {
          field.onChange(
            sortSizes(
              selectedSizes.includes(size)
                ? selectedSizes.filter((s) => s !== size)
                : [...selectedSizes, size]
            )
          );
        };

        const cancelCustomSize = () => {
          setIsAddingCustomSize(false);
          setCustomSizeValue("");
        };

        const addCustomSize = () => {
          const size = customSizeValue.trim().toUpperCase();

          if (!size || allSizes.includes(size)) {
            cancelCustomSize();
            return;
          }

          setCustomSizes((prev) => [...prev, size]);
          field.onChange(sortSizes([...selectedSizes, size]));
          cancelCustomSize();
        };

        return (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-base font-semibold text-foreground">Select Sizes for This Set</h3>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {allSizes.map((size) => {
                const isSelected = selectedSizes.includes(size);

                return (
                  <Button
                    key={size}
                    type="button"
                    onClick={() => toggleSize(size)}
                    className={cn(
                      "flex h-10 items-center gap-1.5 rounded-full neu-button border px-4 text-sm font-medium transition-colors",
                      isSelected
                        ? "border-[#00694C]! bg-[#00694C]! text-[#ffffff]"
                        : "border-transparent! text-muted-foreground hover:bg-muted/70!"
                    )}
                  >
                    {isSelected && <Check className="size-3.5" />}
                    {size}
                  </Button>
                );
              })}

              {isAddingCustomSize ? (
                <div className="flex items-center gap-1.5">
                  <div className="neu-pressed flex h-10 items-center rounded-full px-1">
                    <Input
                      autoFocus
                      value={customSizeValue}
                      onChange={(e) => setCustomSizeValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomSize();
                        }

                        if (e.key === "Escape") {
                          cancelCustomSize();
                        }
                      }}
                      onBlur={() => {
                        if (!customSizeValue.trim()) cancelCustomSize();
                      }}
                      placeholder="e.g. 3XL"
                      className="h-8 w-20 rounded-full border-none bg-transparent text-center shadow-none focus-visible:ring-0"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addCustomSize}
                    className="neu-icon-button text-[#1E1B4B]"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  onClick={() => setIsAddingCustomSize(true)}
                  className="text-[#1E1B4B] p-4 neu-button rounded-full transition-colors"
                >
                  <Plus className="size-3.5" />
                  Other
                </Button>
              )}
            </div>

            <div className="rounded-xl border border-[#00694C]/20 bg-[#00694C]/5 p-4">
              {selectedSizes.length > 0 ? (
                <>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {selectedSizes.map((size, index) => (
                      <Fragment key={size}>
                        {index > 0 && (
                          <span className="text-sm font-medium text-muted-foreground">+</span>
                        )}
                        <Badge className="rounded-md bg-[#00694C] px-2.5 py-2.5 text-sm font-semibold text-white">
                          {size}
                        </Badge>
                      </Fragment>
                    ))}
                  </div>

                  <p className="mt-3 text-center text-sm text-foreground">
                    1 complete set = {selectedSizes.length} pieces (
                    {selectedSizes.join(" + ")} × 1 each)
                  </p>
                </>
              ) : (
                <p className="text-center text-sm text-muted-foreground">
                  Select at least one size to see the set summary
                </p>
              )}
            </div>

            {fieldState.error && (
              <p className="-mt-3 text-sm text-[#EA6365] animate-pulse">{fieldState.error.message}</p>
            )}

            <SemiSetsField control={control} selectedSizes={selectedSizes} />
          </div>
        );
      }}
    />
  );
};

// While editing, say which sizes still hold stock: those can't be removed until they're empty,
// and adding a set size turns existing complete sets into semi sets.
const SetComposition = ({ control, editDesign }) => {
  const stocked = (editDesign?.sizes ?? []).filter((size) => size.piecesInStock > 0);
  const hasSets = (editDesign?.colorVariants ?? []).some((variant) => variant.completeSets > 0);

  return (
    <div className="flex flex-col gap-4">
      {editDesign && (stocked.length > 0 || hasSets) && (
        <div className="rounded-[11px] border border-amber-200 bg-amber-50 px-4 py-3 text-[12.6px] leading-relaxed text-amber-800">
          {stocked.length > 0 && (
            <div>
              <b>In stock now:</b> {stocked.map((size) => `${size.sizeLabel} ${size.piecesInStock} pcs`).join(" · ")} — a size can only be removed once none
              of it is left (loose or inside sets).
            </div>
          )}
          {hasSets && <div>Adding a new size turns this design&apos;s existing complete sets into semi sets, since they don&apos;t contain it.</div>}
        </div>
      )}
      <SetCompositionFields control={control} />
    </div>
  );
};

export default SetComposition;
