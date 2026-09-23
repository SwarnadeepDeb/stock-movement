import { Search, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EVENT_TYPE_LABELS } from "../../utils/stockHistoryLabels";

const fieldClassName =
  "h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const StockHistoryFilters = ({
  query,
  onQueryChange,
  eventType,
  onEventTypeChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onClear,
  hasActiveFilters,
}) => {
  return (
    <div className="flex shrink-0 flex-col gap-3 rounded-[22px] px-3 py-2.5 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center relative w-full flex-1 neu-pressed">
        <Search className="w-5 h-5 text-gray-400 absolute left-4" />
        <input
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by design or variant..."
          aria-label="Search stock history"
          className="bg-transparent border-none outline-none pl-12 pr-4 py-2 w-full text-sm placeholder:text-gray-500 font-medium"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={eventType}
          onChange={(event) => onEventTypeChange(event.target.value)}
          aria-label="Filter by event type"
          className={`${fieldClassName} sm:w-44`}
        >
          <option value="">All Events</option>
          {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(event) => onDateFromChange(event.target.value)}
          aria-label="Filter from date"
          max={dateTo || undefined}
          className={fieldClassName}
        />

        <input
          type="date"
          value={dateTo}
          onChange={(event) => onDateToChange(event.target.value)}
          aria-label="Filter to date"
          min={dateFrom || undefined}
          className={fieldClassName}
        />

        {hasActiveFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
            <XIcon className="size-4" />
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  );
};

export default StockHistoryFilters;
