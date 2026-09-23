import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Download, FileDown, Loader2, Lock, Printer, QrCode, Search, Eye } from "lucide-react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useStockInChallansApi } from "../../../hooks/useStockInChallansApi";
import { getStockInChallansApi } from "../../../services/stockInChallan.api";
import { DEFAULT_CHALLAN_FILTERS as DEFAULT_FILTERS } from "../../../utils/challanFilters";
import { downloadChallanRegisterCsv } from "../../../utils/challanExport";
import { formatDateOnly } from "../../../utils/stockHistoryLabels";

const PAGE_SIZE = 8;

const STATUS_TABS = [
  ["active", "Active"],
  ["defects", "With defects"],
  ["edited", "Edited"],
  ["dropped", "Dropped"],
  ["all", "All"],
];

const DATE_OPTIONS = [
  ["", "Any date"],
  ["7", "Last 7 days"],
  ["30", "Last 30 days"],
  ["90", "Last 90 days"],
  ["90+", "Older than 90 days"],
  ["custom", "Custom range…"],
];

const SORT_OPTIONS = [
  ["new", "Newest first"],
  ["old", "Oldest first"],
  ["pcs", "Most pieces"],
];


const selectClass =
  "h-[38px] rounded-lg border border-slate-300 bg-white px-3 text-[13px] text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-[3px] focus:ring-emerald-500/10";

const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const Mark = ({ tone, children }) => (
  <span
    className={cn(
      "rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-wide",
      tone === "red" ? "border-red-200 bg-red-50 text-red-600" : "border-blue-200 bg-blue-50 text-blue-700",
    )}
  >
    {children}
  </span>
);

const Row = ({ challan, onView, onPrint, onPdf }) => {
  const navigate = useNavigate();
  const dropped = challan.status === "DROPPED";

  const openQr = () => navigate(`/qr-center?challan=${encodeURIComponent(challan.challanNo)}`);

  return (
    <div
      className={cn(
        "grid items-center gap-x-3 gap-y-2 border-b border-slate-100 px-4 py-3.5 text-[13px] last:border-b-0 hover:bg-slate-50/60",
        "grid-cols-[1fr_auto] lg:grid-cols-[.85fr_1.25fr_1.4fr_.75fr_.85fr_1fr_170px]",
        dropped && "bg-slate-50 text-slate-500",
      )}
    >
      <div>
        <span className={cn("whitespace-nowrap rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-900", dropped && "text-slate-400 line-through")}>
          {challan.serialLabel}
        </span>
        {dropped && <div className="mt-1"><Mark tone="red">DROPPED</Mark></div>}
      </div>
      <div className="col-span-2 lg:col-span-1">
        <div className={cn("flex flex-wrap items-center gap-1.5 font-mono text-[12.8px] font-bold text-slate-900", dropped && "text-slate-400 line-through")}>
          {challan.challanNo}
          {challan.edited && <Mark>EDITED</Mark>}
        </div>
        <div className="mt-0.5 text-[11.6px] text-slate-400">{formatDateOnly(challan.stockDate)}</div>
      </div>
      <div className="text-slate-800">{challan.jobberName ?? "—"}</div>
      <div className="font-mono font-bold text-slate-900">{challan.totalPieces} <span className="text-[11px] font-normal text-slate-400">pcs</span></div>
      <div className={cn("text-[11px] font-semibold", challan.defective ? "text-red-600" : "text-emerald-600")}>
        {challan.defective ? `${challan.defective} defective` : "All passed"}
      </div>
      <div>
        <Button type="button" variant="outline" size="sm" onClick={openQr} className="h-8 gap-1.5 rounded-lg text-xs">
          <QrCode className="size-3.5" /> {dropped ? "Retired tags" : "View QR tags"}
        </Button>
      </div>
      <div className="col-span-2 flex items-center justify-end gap-1.5 lg:col-span-1">
        <button type="button" title="Print challan" aria-label="Print challan" onClick={() => onPrint(challan)} className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"><Printer className="size-3.5" /></button>
        <button type="button" title="Download PDF" aria-label="Download PDF" onClick={() => onPdf(challan)} className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"><FileDown className="size-3.5" /></button>
        <Button type="button" variant="outline" size="sm" onClick={() => onView(challan)} className="h-8 gap-1.5 rounded-lg text-xs"><Eye className="size-3.5" /> View</Button>
      </div>
    </div>
  );
};

const ChallanRegister = ({ filters, onFiltersChange: setFilters, onView, onPrint, onPdf }) => {
  const [shown, setShown] = useState(PAGE_SIZE);
  const [isExporting, setIsExporting] = useState(false);
  const debouncedSearch = useDebouncedValue(filters.search, 250);

  const query = useMemo(
    () => ({
      search: debouncedSearch.trim(),
      jobber: filters.jobber,
      dateRange: filters.dateRange,
      from: filters.dateRange === "custom" ? filters.from : "",
      to: filters.dateRange === "custom" ? filters.to : "",
      status: filters.status,
      sort: filters.sort,
    }),
    [debouncedSearch, filters],
  );

  const { data, isLoading, isError, error, isFetching } = useStockInChallansApi({ ...query, page: 1, limit: shown });
  const result = data?.data;
  const rows = result?.items ?? [];
  const total = result?.total ?? 0;
  const counts = result?.counts;
  const serials = result?.serials;
  const jobbers = result?.jobbers ?? [];

  const set = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setShown(PAGE_SIZE);
  };

  const isFiltered = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await getStockInChallansApi({ ...query, page: 1, limit: 500 });
      const items = response.data.items;
      downloadChallanRegisterCsv(items, `stock-in-register-${todayIso()}.csv`);
      toast.success(`Exported ${items.length} challan${items.length === 1 ? "" : "s"}.`);
    } catch (err) {
      toast.error(err?.message ?? "Couldn't export the register.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-emerald-600" />
        <Input
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search by serial no., jobber challan no., issued challan no., jobber, design or variant"
          className="h-12 rounded-xl border-2 border-emerald-200 bg-emerald-50 pl-11 font-mono text-sm focus-visible:border-emerald-500"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <select className={selectClass} value={filters.jobber} onChange={(e) => set({ jobber: e.target.value })} aria-label="Jobber">
          <option value="">All jobbers</option>
          {jobbers.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select className={selectClass} value={filters.dateRange} onChange={(e) => set({ dateRange: e.target.value, from: "", to: "" })} aria-label="Date range">
          {DATE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {filters.dateRange === "custom" && (
          <span className="inline-flex flex-wrap items-center gap-2 text-xs text-slate-500">
            From <input type="date" max={filters.to || todayIso()} value={filters.from} onChange={(e) => set({ from: e.target.value, to: filters.to && e.target.value > filters.to ? e.target.value : filters.to })} className={selectClass} />
            – To <input type="date" min={filters.from} max={todayIso()} value={filters.to} onChange={(e) => set({ to: e.target.value, from: filters.from && e.target.value < filters.from ? e.target.value : filters.from })} className={selectClass} />
          </span>
        )}
        <select className={selectClass} value={filters.sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort">
          {SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {isFiltered && (
          <button type="button" onClick={() => { setFilters(DEFAULT_FILTERS); setShown(PAGE_SIZE); }} className="text-[13px] text-slate-500 hover:text-slate-900">
            Clear filters
          </button>
        )}
        <span className="ml-auto flex items-center gap-3">
          <span className="text-xs text-slate-400">{isFetching && <Loader2 className="mr-1 inline size-3 animate-spin" />}{total} challan{total === 1 ? "" : "s"}</span>
          <Button type="button" variant="outline" size="sm" onClick={handleExport} disabled={isExporting || total === 0} className="gap-1.5">
            {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />} Export (Excel)
          </Button>
        </span>
      </div>

      <div className="mt-3 flex max-w-full gap-0.5 overflow-x-auto rounded-[10px] border border-slate-200 bg-slate-100 p-[3px] sm:inline-flex">
        {STATUS_TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => set({ status: value })}
            className={cn("whitespace-nowrap rounded-[7px] px-3.5 py-1.5 text-[12.6px] font-semibold text-slate-500", filters.status === value && "bg-white text-slate-900 shadow-sm")}
          >
            {label}<span className="ml-1 font-mono text-[11px] text-slate-400">{counts?.[value] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        <div className="hidden grid-cols-[.85fr_1.25fr_1.4fr_.75fr_.85fr_1fr_170px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[9.8px] font-bold uppercase tracking-wider text-slate-400 lg:grid">
          <span>Sr. no.</span><span>Jobber challan no.</span><span>Jobber</span><span>Total pcs</span><span>QC</span><span>QR tags</span><span />
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> Loading…</div>
        ) : isError ? (
          <div className="py-10 text-center text-sm text-red-600">{error.message}</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500"><b className="block text-[15px] text-slate-900">No challans match</b>Try another search or filter, or clear them.</div>
        ) : (
          <div className="max-h-130 overflow-y-auto">
            {rows.map((challan) => <Row key={challan.id} challan={challan} onView={onView} onPrint={onPrint} onPdf={onPdf} />)}
          </div>
        )}
      </div>

      {total > rows.length && (
        <div className="flex justify-center pt-3.5">
          <Button type="button" variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE_SIZE)}>
            Show {Math.min(PAGE_SIZE, total - rows.length)} more
          </Button>
        </div>
      )}

      {serials?.last && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <Lock className="size-3" /> Serial nos. <b className="font-mono">{serials.first}</b> – <b className="font-mono">{serials.last}</b> issued · next stock-in gets{" "}
          <b className="font-mono">{serials.next}</b>
          {serials.dropped.length > 0 && (
            <> · dropped (never reused): {serials.dropped.map((label) => (
              <span key={label} className="rounded-md border border-slate-200 bg-white px-1.5 font-mono text-slate-400 line-through">{label}</span>
            ))}</>
          )}
        </div>
      )}
    </div>
  );
};

export default ChallanRegister;
