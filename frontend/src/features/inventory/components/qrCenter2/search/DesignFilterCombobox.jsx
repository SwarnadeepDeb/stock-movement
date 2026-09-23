import { useState } from "react";
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
import { useDesignSearchApi, MIN_DESIGN_SEARCH_LENGTH } from "../../../hooks/useDesignSearchApi.js";

const SEARCH_DEBOUNCE_MS = 250;

// Only these input-change reasons mean the user is editing the text (vs. an item being picked,
// reported separately via onValueChange) — same guard JobberSearchInput uses so a stale
// designId can't survive a re-type.
const TYPING_REASONS = new Set(["input-change", "input-clear", "input-paste", "clear-press"]);

const labelFor = (design) => (design ? `${design.code} · ${design.name}` : "");

// Filter-bar equivalent of the plain "All designs" <select> — with hundreds of factory designs
// a full option list doesn't scale, so this searches the backend (like DesignSearchInput) while
// still falling back to the already-fetched `designs` page when nothing has been typed.
//
// `keywordHint` is the main search bar's text: as long as no design is picked and the user
// hasn't typed directly into this box, it pre-filters the dropdown to designs matching that
// text (e.g. typing "kp100" up top narrows this list to the KP100 designs) without silently
// guessing a selection — the user still has to click one when there's more than one match.
export default function DesignFilterCombobox({ designs, value, onChange, keywordHint = "" }) {
    const selected = designs.find((d) => String(d.id) === String(value)) ?? null;
    const [query, setQuery] = useState(labelFor(selected));

    // Selection can also change from outside (e.g. the "Clear filters" button) — resync the
    // visible text during render rather than in an effect (react.dev's "adjusting state on a
    // prop change" pattern), so it never lags a render behind.
    const [syncedValue, setSyncedValue] = useState(value);
    if (syncedValue !== value) {
        setSyncedValue(value);
        setQuery(labelFor(selected));
    }

    const effectiveQuery = query || (selected ? "" : keywordHint);
    const debouncedQuery = useDebouncedValue(effectiveQuery, SEARCH_DEBOUNCE_MS);
    const keyword = debouncedQuery.trim();
    const shouldSearch = keyword.length >= MIN_DESIGN_SEARCH_LENGTH;

    const { data: response, isFetching, isError } = useDesignSearchApi({ keyword });
    const searched = response?.data ?? [];
    const items = shouldSearch ? searched : designs;

    const handleInputValueChange = (text, eventDetails) => {
        setQuery(text);
        if (TYPING_REASONS.has(eventDetails.reason) && value) {
            onChange("");
        }
    };

    const handleValueChange = (item) => onChange(item ? String(item.id) : "");

    return (
        <Combobox
            items={items}
            filter={null}
            value={selected}
            inputValue={query}
            onInputValueChange={handleInputValueChange}
            onValueChange={handleValueChange}
            itemToStringLabel={labelFor}
            isItemEqualToValue={(item, val) => item?.id != null && String(item.id) === String(val?.id)}
        >
            <ComboboxInput
                placeholder="All designs"
                showTrigger={false}
                showClear={Boolean(query)}
                className="h-[35px] w-full sm:w-[190px] rounded-[9px] border border-slate-300 bg-white text-[13.3px] **:data-[slot=input-group-control]:pl-7 **:data-[slot=input-group-control]:text-[13.3px]"
            >
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            </ComboboxInput>

            <ComboboxContent>
                <ComboboxList>
                    <ComboboxEmpty>
                        {shouldSearch && isFetching && (
                            <span className="inline-flex items-center gap-2">
                                <Loader2Icon className="size-4 animate-spin" />
                                Searching designs...
                            </span>
                        )}
                        {shouldSearch && !isFetching && isError && "Failed to search designs. Please try again."}
                        {shouldSearch && !isFetching && !isError && `No designs found for "${keyword}".`}
                        {!shouldSearch && items.length === 0 && "No designs yet."}
                    </ComboboxEmpty>

                    {items.map((design) => (
                        <ComboboxItem key={design.id} value={design}>
                            {labelFor(design)}
                        </ComboboxItem>
                    ))}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}
