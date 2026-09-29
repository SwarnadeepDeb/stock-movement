import { useId, useMemo, useState } from "react";
import { useController, useFormContext, useWatch } from "react-hook-form";
import { Loader2Icon, PlusIcon } from "lucide-react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { useItemNamesApi } from "../hooks/useItemNamesApi";
import { formatItemName, itemNameRules } from "../utils/itemName";

// Same reasons PatternSearchInput treats as "the user typed" rather than "an item was picked" —
// only these drop a previously selected itemNameId, so editing the text can't keep a stale id.
const TYPING_REASONS = new Set(["input-change", "input-clear", "input-paste", "clear-press"]);

const normalize = (text) => text.trim().toLowerCase().replace(/\s+/g, " ");

// Item Name dropdown backed by the item_names lookup table (seeded with the default names).
// A name that isn't in the list is still accepted: itemNameId stays null and the backend adds
// the name to the table when the design is saved (DesignService._resolveItemName).
const ItemNameSelect = ({ name = "itemNameId", nameField = "itemName", label = "Item Name", disabled = false }) => {
  const { control, setValue } = useFormContext();
  const id = useId();

  const itemNameId = useWatch({ control, name });
  // Registers the text field with its rules so the wizard's step check (form.trigger) and
  // submit both run them; the error is rendered under the input below.
  const { fieldState: { error } } = useController({ control, name: nameField, rules: itemNameRules });
  const itemName = useWatch({ control, name: nameField }) ?? "";
  const value = itemName ? { id: itemNameId ?? null, name: itemName } : null;

  // What the user has typed since the last selection — drives filtering. Kept separate from
  // itemName so reopening the dropdown after picking an option still shows the whole list.
  const [query, setQuery] = useState("");

  const { data: response, isLoading, isError } = useItemNamesApi();
  const options = useMemo(() => response?.data ?? [], [response]);

  const trimmedQuery = query.trim();
  const filtered = trimmedQuery
    ? options.filter((option) => normalize(option.name).includes(normalize(trimmedQuery)))
    : options;
  const isNewName = trimmedQuery && !options.some((option) => normalize(option.name) === normalize(trimmedQuery));
  const items = isNewName ? [...filtered, { id: null, name: trimmedQuery, isNew: true }] : filtered;

  const handleInputValueChange = (raw, eventDetails) => {
    // Free text is always accepted as the item name — picking the "Add" option is optional.
    // Typed text is shaped to the Item Name rules as it's entered (capitals, letters only, max 50).
    const text = TYPING_REASONS.has(eventDetails.reason) ? formatItemName(raw) : raw;
    setValue(nameField, text, { shouldDirty: true, shouldValidate: true });

    if (TYPING_REASONS.has(eventDetails.reason)) {
      setValue(name, null, { shouldDirty: true });
      setQuery(text);
    }
  };

  const handleValueChange = (item) => {
    setValue(name, item?.id ?? null, { shouldDirty: true });
    setValue(nameField, item?.name ?? "", { shouldDirty: true, shouldValidate: true });
    setQuery("");
  };

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-[14px] leading-4.5 font-medium text-gray-700 mb-2">
        {label}
      </label>

      <Combobox
        items={items}
        filter={null}
        value={value}
        inputValue={itemName}
        onInputValueChange={handleInputValueChange}
        onValueChange={handleValueChange}
        onOpenChange={(open) => open && setQuery("")}
        itemToStringLabel={(item) => item?.name ?? ""}
        isItemEqualToValue={(item, val) =>
          item?.id != null ? item.id === val?.id : normalize(item?.name ?? "") === normalize(val?.name ?? "")
        }
      >
        <ComboboxInput
          id={id}
          placeholder="Select or type an item name..."
          disabled={disabled}
          showClear
          className="bg-transparent border border-[#4C4A85] h-12 rounded-lg focus-within:ring-2 focus-within:ring-[#9A99BE] w-full **:data-[slot=input-group-control]:text-sm"
        />

        <ComboboxContent>
          <ComboboxList>
            <ComboboxEmpty>
              {isLoading && (
                <span className="inline-flex items-center gap-2">
                  <Loader2Icon className="size-4 animate-spin" />
                  Loading item names...
                </span>
              )}
              {!isLoading && isError && "Failed to load item names. You can still type one."}
              {!isLoading && !isError && "No item names yet. Type one to add it."}
            </ComboboxEmpty>

            {items.map((item) =>
              item.isNew ? (
                <ComboboxItem key={`new:${item.name}`} value={item}>
                  <PlusIcon className="text-[#4C4A85]" />
                  Add “{item.name}” as new item name
                </ComboboxItem>
              ) : (
                <ComboboxItem key={item.id} value={item}>
                  {item.name}
                </ComboboxItem>
              )
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {error && <p className="text-sm text-[#EA6365] animate-pulse">{error.message}</p>}
    </div>
  );
};

export default ItemNameSelect;
