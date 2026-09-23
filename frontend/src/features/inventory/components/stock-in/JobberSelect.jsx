import { useMemo, useState } from "react";
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
import { useJobberSearchApi, MIN_JOBBER_SEARCH_LENGTH } from "../../../design/hooks/useJobberSearchApi";

const SEARCH_DEBOUNCE_MS = 250;

// Free-text-friendly jobber picker for Stock In: searches the real jobbers table (same
// data Design Master registers jobbers into) but, unlike JobberSearchInput, isn't bound to
// react-hook-form — Stock In's jobber field is informational only (no stockIn API field
// persists it yet), so it's kept as plain local state on the page.
const JobberSelect = ({ value, onChange, placeholder = "Select Jobber...", id }) => {
  const [query, setQuery] = useState(value ?? "");
  // `value` can change from outside (e.g. auto-filled from a design); typing already echoes
  // the same text back, so this only fires for external changes.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (value !== undefined && value !== query) setQuery(value ?? "");
  }
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const keyword = debouncedQuery.trim();
  const shouldSearch = keyword.length >= MIN_JOBBER_SEARCH_LENGTH;

  const { data: response, isFetching, isError } = useJobberSearchApi({ keyword });
  const jobbers = useMemo(() => response?.data ?? [], [response]);

  const handleValueChange = (item) => {
    if (!item) return;
    setQuery(item.name);
    onChange?.(item);
  };

  return (
    <Combobox
      items={jobbers}
      filter={null}
      inputValue={query}
      onInputValueChange={(next) => {
        setQuery(next);
        onChange?.({ id: null, name: next });
      }}
      onValueChange={handleValueChange}
      itemToStringLabel={(item) => item?.name ?? ""}
      isItemEqualToValue={(item, other) => item?.id === other?.id}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        showTrigger
        showClear
        className="h-[42px] rounded-lg border-slate-200 bg-white focus-within:border-emerald-500 focus-within:ring-[3px] focus-within:ring-emerald-500/10 **:data-[slot=input-group-control]:pl-9 **:data-[slot=input-group-control]:text-sm"
      >
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      </ComboboxInput>

      <ComboboxContent className="min-w-(--anchor-width)">
        <ComboboxList>
          <ComboboxEmpty>
            {!shouldSearch && `Type at least ${MIN_JOBBER_SEARCH_LENGTH} characters to search jobbers.`}
            {shouldSearch && isFetching && (
              <span className="inline-flex items-center gap-2">
                <Loader2Icon className="size-4 animate-spin" />
                Searching jobbers...
              </span>
            )}
            {shouldSearch && !isFetching && isError && "Failed to search jobbers."}
            {shouldSearch && !isFetching && !isError && `No jobbers found for "${keyword}". Press enter to use it as free text.`}
          </ComboboxEmpty>

          {jobbers.map((item) => (
            <ComboboxItem key={item.id} value={item}>
              {item.name}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
};

export default JobberSelect;
