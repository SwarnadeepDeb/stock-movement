import { useId, useMemo } from "react";
import { useController, useFormContext, useWatch } from "react-hook-form";
import { Loader2Icon, SearchIcon } from "lucide-react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatLettersOnly, lettersOnlyRules } from "../utils/nameRules";
import { useQualitySearchApi, MIN_QUALITY_SEARCH_LENGTH } from "../hooks/useQualitySearchApi";

const SEARCH_DEBOUNCE_MS = 250;

// Reasons the base-ui Combobox reports when the input text changes because the user typed,
// pasted, or cleared it (as opposed to it changing because an item was selected) — only these
// should drop a previously selected qualityId, so re-typing after a selection can't leave a
// stale id behind. Values are the kebab-case strings from @base-ui/react's internal REASONS map.
const TYPING_REASONS = new Set(["input-change", "input-clear", "input-paste", "clear-press"]);

const QualitySearchInput = ({ name = "qualityId", nameField = "quality", label = "Quality", disabled = false }) => {
  const { control, setValue } = useFormContext();
  const id = useId();

  // react-hook-form is the only source of truth here — see JobberSearchInput for why `value`
  // is kept in sync with the form instead of held as component-local state.
  const qualityId = useWatch({ control, name });
  // Registers the text field with the letters-only / max-50 rules so the wizard's step check
  // (form.trigger) and submit run them; the error is rendered under the input below.
  const { fieldState: { error } } = useController({ control, name: nameField, rules: lettersOnlyRules("Quality") });
  const qualityName = useWatch({ control, name: nameField }) ?? "";
  const value = qualityName ? { id: qualityId ?? null, name: qualityName } : null;

  const debouncedKeyword = useDebouncedValue(qualityName, SEARCH_DEBOUNCE_MS);
  const keyword = debouncedKeyword.trim();
  const shouldSearch = keyword.length >= MIN_QUALITY_SEARCH_LENGTH;

  const { data: response, isFetching, isError } = useQualitySearchApi({ keyword });
  const qualities = useMemo(() => response?.data ?? [], [response]);

  const handleInputValueChange = (raw, eventDetails) => {
    // Typed text is shaped to the rules as it's entered (letters/spaces/hyphens, max 50).
    const text = TYPING_REASONS.has(eventDetails.reason) ? formatLettersOnly(raw) : raw;
    setValue(nameField, text, { shouldDirty: true, shouldValidate: true });

    // Typing/pasting/clearing means whatever was selected before no longer applies — an item
    // selection is reported separately via onValueChange (reason "item-press"), which this
    // guard deliberately leaves alone so it doesn't undo the id that call just set.
    if (TYPING_REASONS.has(eventDetails.reason)) {
      setValue(name, null, { shouldDirty: true });
    }
  };

  const handleValueChange = (item) => {
    if (!item) {
      setValue(name, null, { shouldDirty: true });
      setValue(nameField, "", { shouldDirty: true });
      return;
    }

    setValue(name, item.id, { shouldDirty: true });
    setValue(nameField, item.name, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-[14px] leading-4.5 font-medium text-gray-700 mb-2">
        {label}
      </label>

      <Combobox
        items={qualities}
        filter={null}
        value={value}
        inputValue={qualityName}
        onInputValueChange={handleInputValueChange}
        onValueChange={handleValueChange}
        itemToStringLabel={(item) => item?.name ?? ""}
        isItemEqualToValue={(item, val) => item?.id != null && item?.id === val?.id}
      >
        <ComboboxInput
          id={id}
          placeholder="Search quality..."
          disabled={disabled}
          showTrigger={false}
          showClear
          className="bg-transparent border border-[#4C4A85] h-12 rounded-lg focus-within:ring-2 focus-within:ring-[#9A99BE] w-full **:data-[slot=input-group-control]:pl-9 **:data-[slot=input-group-control]:text-sm"
        >
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        </ComboboxInput>

        <ComboboxContent>
          <ComboboxList>
            <ComboboxEmpty>
              {!shouldSearch && (
                <span className="inline-flex items-center gap-2">
                  <SearchIcon className="size-4" />
                  Type at least {MIN_QUALITY_SEARCH_LENGTH} characters to search qualities.
                </span>
              )}
              {shouldSearch && isFetching && (
                <span className="inline-flex items-center gap-2">
                  <Loader2Icon className="size-4 animate-spin" />
                  Searching qualities...
                </span>
              )}
              {shouldSearch && !isFetching && isError && "Failed to search qualities. Please try again."}
              {shouldSearch && !isFetching && !isError &&
                `No existing quality found for "${keyword}". This name will be added when the design is saved.`}
            </ComboboxEmpty>

            {qualities.map((item) => (
              <ComboboxItem key={item.id} value={item}>
                {item.name}
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {error && <p className="text-sm text-[#EA6365] animate-pulse">{error.message}</p>}
    </div>
  );
};

export default QualitySearchInput;
