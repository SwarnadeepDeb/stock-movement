import { useState } from "react";
import { Loader2 } from "lucide-react";

import DataTable from "@/components/shared/table/DataTable";
import TablePageLayout from "@/components/shared/layout/TablePageLayout";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useStockHistoryApi } from "../hooks/useStockHistoryApi";
import { stockHistoryColumns } from "../table/StockHistoryColumns";
import StockHistoryFilters from "../components/stock-history/StockHistoryFilters";

const SEARCH_DEBOUNCE_MS = 250;
const MIN_KEYWORD_LENGTH = 2;
const PAGE_LIMIT = 20;

const StockHistory = () => {
  const [query, setQuery] = useState("");
  const [eventType, setEventType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const trimmedQuery = debouncedQuery.trim();
  // Mirrors the backend's own min-length rule (listStockHistoryQuerySchema).
  const keyword = trimmedQuery.length >= MIN_KEYWORD_LENGTH ? trimmedQuery : undefined;
  const hasActiveFilters = Boolean(query || eventType || dateFrom || dateTo);

  const {
    data: response,
    isPending,
    isError,
    error,
    refetch,
  } = useStockHistoryApi({
    page,
    limit: PAGE_LIMIT,
    keyword,
    eventType: eventType || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const historyItems = response?.data ?? [];
  const meta = response?.meta;

  const resetToFirstPage = () => setPage(1);

  const handleQueryChange = (value) => {
    setQuery(value);
    resetToFirstPage();
  };

  const handleEventTypeChange = (value) => {
    setEventType(value);
    resetToFirstPage();
  };

  const handleDateFromChange = (value) => {
    setDateFrom(value);
    resetToFirstPage();
  };

  const handleDateToChange = (value) => {
    setDateTo(value);
    resetToFirstPage();
  };

  const handleClearFilters = () => {
    setQuery("");
    setEventType("");
    setDateFrom("");
    setDateTo("");
    resetToFirstPage();
  };

  return (
    <TablePageLayout className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1E1B4B] tracking-tight">Stock History</h1>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-[24px] glass-table p-2 space-y-2">
        <StockHistoryFilters
          query={query}
          onQueryChange={handleQueryChange}
          eventType={eventType}
          onEventTypeChange={handleEventTypeChange}
          dateFrom={dateFrom}
          onDateFromChange={handleDateFromChange}
          dateTo={dateTo}
          onDateToChange={handleDateToChange}
          onClear={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        <div className="min-h-0 flex-1 bg-transparent">
          {isPending ? (
            <Loader2 className="animate-spin text-cyan-400" />
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
              <p className="text-sm text-muted-foreground">{error?.message ?? "Unable to load stock history."}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <DataTable
              columns={stockHistoryColumns}
              data={historyItems}
              pageSize={PAGE_LIMIT}
              emptyState={
                hasActiveFilters
                  ? { title: "No matching history", description: "No stock history matches your filters." }
                  : { title: "No stock history found", description: "Stock additions and transformations will appear here." }
              }
            />
          )}
        </div>

        {meta && meta.totalPages > 1 && (
          <div className="flex shrink-0 items-center justify-between px-3 py-1.5 text-sm text-muted-foreground">
            <span>
              Page {meta.page} of {meta.totalPages} · {meta.total} events
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.min(meta.totalPages, current + 1))}
                disabled={page >= meta.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </TablePageLayout>
  );
};

export default StockHistory;
