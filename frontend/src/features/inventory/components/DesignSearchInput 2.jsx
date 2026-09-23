import { useMemo, useState } from "react";
import { Loader2Icon, SearchIcon } from "lucide-react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useDesignSearchApi, MIN_DESIGN_SEARCH_LENGTH } from "../hooks/useDesignSearchApi";

const SEARCH_DEBOUNCE_MS = 250;
const MAX_PREVIEW_DOTS = 5;

const formatInr = (amount) =>
  `₹${Number(amount ?? 0).toLocaleString("en-IN")}`;

const flattenToVariantItems = (designs) =>
  designs.flatMap((design) =>
    (design.colorVariants ?? []).map((variant) => ({
      designId: design.id,
      colorVariantId: variant.id,
      designCode: design.code,
      designName: design.name,
      colorName: variant.colorName,
      colorHex: variant.colorHex,
      imageUrl: variant.imageUrl,
      sellingPricePerPiece: design.defaultSellingPricePerPiece,
    }))
  );

const groupByDesign = (items) => {
  const groups = new Map();

  for (const item of items) {
    if (!groups.has(item.designId)) {
      groups.set(item.designId, {
        designId: item.designId,
        designCode: item.designCode,
        designName: item.designName,
        sellingPricePerPiece: item.sellingPricePerPiece,
        variants: [],
      });
    }
    groups.get(item.designId).variants.push(item);
  }

  return [...groups.values()];
};

const getVariantLabel = (item) =>
  `${item.designCode ? `${item.designCode} · ` : ""}${item.designName} — ${item.colorName}`;

const isSameVariant = (item, other) =>
  item?.designId === other?.designId && item?.colorVariantId === other?.colorVariantId;

const DesignSearchInput = ({
  onSelect,
  placeholder = "Search by design code or name...",
  disabled = false,
  id,
}) => {
  // Remounting on every selection resets the input text, the debounced keyword, and the
  // popover's open/highlight state all at once, so the component is immediately ready for
  // the next search instead of showing the just-selected variant's label.
  const [resetKey, setResetKey] = useState(0);

  const handleSelect = (selection) => {
    onSelect?.(selection);
    setResetKey((key) => key + 1);
  };

  return (
    <DesignSearchInputSession
      key={resetKey}
      id={id}
      placeholder={placeholder}
      disabled={disabled}
      onSelect={handleSelect}
    />
  );
};

const DesignSearchInputSession = ({ onSelect, placeholder, disabled, id }) => {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const keyword = debouncedQuery.trim();
  const shouldSearch = keyword.length >= MIN_DESIGN_SEARCH_LENGTH;

  const { data: response, isFetching, isError } = useDesignSearchApi({ keyword });
  const designs = useMemo(() => response?.data ?? [], [response]);

  const variantItems = useMemo(() => flattenToVariantItems(designs), [designs]);
  const groups = useMemo(() => groupByDesign(variantItems), [variantItems]);

  const handleValueChange = (item) => {
    if (!item) return;
    onSelect?.(item);
  };

  return (
    <Combobox
      items={variantItems}
      filter={null}
      inputValue={query}
      onInputValueChange={setQuery}
      onValueChange={handleValueChange}
      itemToStringLabel={getVariantLabel}
      isItemEqualToValue={isSameVariant}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        disabled={disabled}
        showTrigger={false}
        showClear
        className="neu-pressed h-10 rounded-full border-none bg-transparent shadow-none **:data-[slot=input-group-control]:pl-9"
      >
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
      </ComboboxInput>

      <ComboboxContent className="toolbar-neu min-w-(--anchor-width) rounded-[20px] bg-transparent shadow-none ring-0 mt-2">
        <ComboboxList>
          <ComboboxEmpty>
            {!shouldSearch && (
              <span className="inline-flex items-center gap-2">
                <SearchIcon className="size-4" />
                Type at least {MIN_DESIGN_SEARCH_LENGTH} characters to search designs.
              </span>
            )}
            {shouldSearch && isFetching && (
              <span className="inline-flex items-center gap-2">
                <Loader2Icon className="size-4 animate-spin" />
                Searching designs...
              </span>
            )}
            {shouldSearch && !isFetching && isError && "Failed to search designs. Please try again."}
            {shouldSearch && !isFetching && !isError && `No designs found for "${keyword}".`}
          </ComboboxEmpty>

          {groups.map((group) => (
            <ComboboxGroup key={group.designId}>
              <ComboboxLabel className="flex items-center gap-2 py-1.5">
                <div className="flex shrink-0 -space-x-1">
                  {group.variants.slice(0, MAX_PREVIEW_DOTS).map((item) => (
                    <span
                      key={item.colorVariantId}
                      className="size-3 shrink-0 rounded-full ring-2 ring-popover"
                      style={{ backgroundColor: item.colorHex }}
                    />
                  ))}
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {group.designCode ? `${group.designCode} · ` : ""}
                    {group.designName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Set: {formatInr(group.sellingPricePerPiece)}
                  </span>
                </div>
              </ComboboxLabel>

              <div className="flex flex-wrap gap-1 px-1.5 pb-1.5">
                {group.variants.map((item) => (
                  <ComboboxItem
                    key={item.colorVariantId}
                    value={item}
                    className="neu-button w-auto shrink-0 gap-1.5 rounded-full border-none py-1 pr-6 pl-2"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.colorHex }}
                    />
                    {item.colorName}
                  </ComboboxItem>
                ))}
              </div>
            </ComboboxGroup>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
};

export default DesignSearchInput;
