import { useCallback, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { AlertTriangle, Clock, Download, Loader2, Package, Plus, Printer, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCurrentStockOverviewApi, useStockAdjustmentsApi } from "../hooks/useCurrentStockOverviewApi";
import { resolveStockTagApi } from "../services/currentStockOverview.api";
import {
  downloadCurrentStockCsv,
  filterVariants,
  formatInr,
  formatNumber,
  groupByDesign,
  SORTS,
  STATUS_FILTERS,
  sumBy,
  variantLabel,
} from "../utils/currentStock";
import { Sheet } from "../components/current-stock/primitives";
import StockTable from "../components/current-stock/StockTable";
import SizeMatrix from "../components/current-stock/SizeMatrix";
import AdjustmentLog from "../components/current-stock/AdjustmentLog";
import VariantDrawer from "../components/current-stock/VariantDrawer";
import AddStockDialog from "../components/current-stock/AddStockDialog";
import ReverseDialog from "../components/current-stock/ReverseDialog";
import PrintReport from "../components/current-stock/PrintReport";

const DEFAULT_FILTERS = { query: "", status: "all", designId: "", sort: "code" };

const SELECT =
  "cursor-pointer rounded-[9px] border-[1.5px] border-slate-300 bg-white py-2 pl-3 pr-8 text-[13px] text-slate-700 outline-none focus:border-emerald-500";

const Stat = ({ value, label, className }) => (
  <div className="flex-1 basis-1/2 border-b border-slate-200 px-5 py-3.5 md:basis-1/3 xl:basis-0 xl:border-b-0 xl:border-r xl:last:border-r-0">
    <div className={cn("font-mono text-xl font-bold text-slate-900", className)}>{value}</div>
    <div className="mt-0.5 text-[11.3px] text-slate-500">{label}</div>
  </div>
);

const ALERT_TONES = {
  red: { icon: "bg-red-50 text-red-600", active: "border-red-500" },
  amber: { icon: "bg-amber-50 text-amber-700", active: "border-amber-500" },
  violet: { icon: "bg-violet-50 text-violet-700", active: "border-violet-500" },
};

const AlertCard = ({ tone, icon: Icon, count, label, names, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      "flex w-full items-center gap-3.5 rounded-[13px] border-[1.5px] bg-white px-4 py-3.5 text-left transition-colors hover:border-slate-300",
      active ? cn(ALERT_TONES[tone].active, "shadow-[0_0_0_3px_rgba(15,23,42,0.06)]") : "border-slate-200",
    )}
  >
    <span className={cn("grid size-[38px] flex-none place-items-center rounded-[10px]", ALERT_TONES[tone].icon)}>
      <Icon className="size-[18px]" />
    </span>
    <span className="min-w-0">
      <span className="block font-mono text-[19px] font-bold leading-tight text-slate-900">{count}</span>
      <span className="block truncate text-xs text-slate-500">
        {label} ·{" "}
        {count ? (
          <span className="text-slate-700">
            {names.slice(0, 2).join(", ")}
            {count > 2 ? ` +${count - 2}` : ""}
          </span>
        ) : (
          "none"
        )}
      </span>
    </span>
  </button>
);

const TabButton = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "-mb-px border-b-2 px-4 py-2.5 text-[13.5px] font-semibold transition-colors",
      active ? "border-emerald-600 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800",
    )}
  >
    {children}
  </button>
);

const CurrentStock = () => {
  const [tab, setTab] = useState("stock");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [expanded, setExpanded] = useState({});
  const [drawerVariantId, setDrawerVariantId] = useState(null);
  const [addStockFor, setAddStockFor] = useState(undefined); // undefined = closed, null = no preselected variant
  const [reverseEntry, setReverseEntry] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isResolvingTag, setIsResolvingTag] = useState(false);

  const overviewQuery = useCurrentStockOverviewApi();
  // Always fetched (not only on the Log tab) — its count shows on the tab label.
  const adjustmentsQuery = useStockAdjustmentsApi();

  const overview = overviewQuery.data?.data;
  const variants = useMemo(() => overview?.variants ?? [], [overview]);
  const adjustments = useMemo(() => adjustmentsQuery.data?.data ?? [], [adjustmentsQuery.data]);

  const filtered = useMemo(() => filterVariants(variants, filters), [variants, filters]);
  const designs = useMemo(() => groupByDesign(variants).map((group) => group.design), [variants]);

  const outOfStock = variants.filter((variant) => variant.status === "OUT_OF_STOCK");
  const lowStock = variants.filter((variant) => variant.status === "LOW");
  const ageing = variants.filter((variant) => variant.isAgeing);

  const isFiltered = Boolean(filters.query.trim() || filters.status !== "all" || filters.designId);
  const hasAnyFilter = isFiltered || filters.sort !== "code";

  // The log tab shares the search box + design filter, matched against its own fields.
  const filteredAdjustments = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return adjustments.filter((entry) => {
      if (filters.designId && String(entry.design.id) !== String(filters.designId)) return false;
      if (!q) return true;
      return [`ADJ-${String(entry.id).padStart(4, "0")}`, entry.design.code, entry.design.name, entry.variant.colorName, entry.reason, entry.note, entry.createdBy]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [adjustments, filters.query, filters.designId]);

  const setFilter = (patch) => setFilters((current) => ({ ...current, ...patch }));

  const toggleAlert = (status) => {
    setTab("stock");
    setFilter({ status: filters.status === status ? "all" : status });
  };

  const openDrawer = useCallback((colorVariantId) => setDrawerVariantId(colorVariantId), []);
  const closeDrawer = useCallback(() => setDrawerVariantId(null), []);
  const closePrint = useCallback(() => setIsPrinting(false), []);

  // Enter in the search box: if it's a tag ID (QR short code), jump straight to that variant.
  const handleSearchKeyDown = async (event) => {
    if (event.key !== "Enter") return;
    const code = filters.query.trim();
    if (!code || code.includes(" ")) return;
    setIsResolvingTag(true);
    try {
      const result = await resolveStockTagApi(code);
      openDrawer(result.data.colorVariantId);
    } catch {
      if (filtered.length === 0) toast.info(`No design, colour or tag matches "${code}".`);
    } finally {
      setIsResolvingTag(false);
    }
  };

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.info("Nothing to export — clear the filters first.");
      return;
    }
    const fileName = downloadCurrentStockCsv(filtered, overview?.asOn ?? "today");
    toast.success(`Downloaded ${fileName}`);
  };

  const countLabel =
    tab === "log"
      ? `${filteredAdjustments.length} entr${filteredAdjustments.length === 1 ? "y" : "ies"}`
      : `${filtered.length} variant${filtered.length === 1 ? "" : "s"}`;

  if (overviewQuery.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
        <Loader2 className="size-4 animate-spin" /> Loading current stock…
      </div>
    );
  }

  if (overviewQuery.isError) {
    return (
      <div className="mx-auto max-w-lg py-24 text-center text-sm">
        <p className="text-red-600">{overviewQuery.error.message}</p>
        <Button type="button" variant="outline" className="mt-3" onClick={() => overviewQuery.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1340px] flex-col gap-5">
      <Sheet>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight text-slate-900">Current Stock</h1>
            <p className="mt-1 max-w-[72ch] text-sm text-slate-500">
              Everything on hand right now, counted piece by piece from Stock In, sales and adjustments. Every manual change
              is logged and can be reversed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setIsPrinting(true)} className="gap-2 text-[13px] font-semibold">
              <Printer className="size-3.5" />
              Print report
            </Button>
            <Button type="button" variant="outline" onClick={handleExport} className="gap-2 text-[13px] font-semibold">
              <Download className="size-3.5" />
              Export (Excel)
            </Button>
            <Button
              type="button"
              onClick={() => setAddStockFor(null)}
              disabled={variants.length === 0}
              className="gap-2 bg-emerald-600 text-[13px] font-semibold text-white hover:bg-emerald-700"
            >
              <Plus className="size-4" />
              Add stock
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap overflow-hidden rounded-xl border border-slate-200 bg-slate-50 xl:flex-nowrap">
          <Stat value={formatNumber(sumBy(variants, (variant) => variant.totalPieces))} label="Pieces in stock" />
          <Stat value={sumBy(variants, (variant) => variant.sets)} label="Complete sets" />
          <Stat value={sumBy(variants, (variant) => variant.semiSets)} label="Semi sets" />
          <Stat value={sumBy(variants, (variant) => variant.loosePieces)} label="Loose pieces" />
          <Stat value={formatInr(sumBy(variants, (variant) => variant.value))} label="Stock value (at selling rate)" className="text-emerald-700" />
          <Stat value={`${variants.filter((variant) => variant.totalPieces > 0).length} / ${variants.length}`} label="Variants in stock" />
        </div>
      </Sheet>

      <div className="grid gap-3 lg:grid-cols-3">
        <AlertCard
          tone="red"
          icon={AlertTriangle}
          count={outOfStock.length}
          label="Out of stock"
          names={outOfStock.map(variantLabel)}
          active={filters.status === "out"}
          onClick={() => toggleAlert("out")}
        />
        <AlertCard
          tone="amber"
          icon={Package}
          count={lowStock.length}
          label="Low stock"
          names={lowStock.map(variantLabel)}
          active={filters.status === "low"}
          onClick={() => toggleAlert("low")}
        />
        <AlertCard
          tone="violet"
          icon={Clock}
          count={ageing.length}
          label={`Ageing ${overview?.ageingDays ?? 60}+ days`}
          names={ageing.map(variantLabel)}
          active={filters.status === "ageing"}
          onClick={() => toggleAlert("ageing")}
        />
      </div>

      <Sheet>
        <div className="-mt-1 mb-4 flex gap-0.5 overflow-x-auto border-b border-slate-200">
          <TabButton active={tab === "stock"} onClick={() => setTab("stock")}>
            Stock
          </TabButton>
          <TabButton active={tab === "matrix"} onClick={() => setTab("matrix")}>
            Size matrix
          </TabButton>
          <TabButton active={tab === "log"} onClick={() => setTab("log")}>
            Adjustment log
            <span className="ml-1.5 font-mono text-[11px] text-slate-400">{adjustments.length}</span>
          </TabButton>
        </div>

        <div className="relative">
          <span className="pointer-events-none absolute left-[18px] top-1/2 -translate-y-1/2 text-emerald-600">
            {isResolvingTag ? <Loader2 className="size-[19px] animate-spin" /> : <Search className="size-[19px]" />}
          </span>
          <input
            value={filters.query}
            onChange={(event) => setFilter({ query: event.target.value })}
            onKeyDown={handleSearchKeyDown}
            autoComplete="off"
            spellCheck={false}
            placeholder="Search design code, name, colour — or paste a tag ID and press Enter"
            className="w-full rounded-[13px] border-2 border-emerald-200 bg-emerald-50 py-3.5 pl-12 pr-4 font-mono text-[14.5px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          {tab !== "log" && (
            <div className="inline-flex flex-wrap gap-0.5 rounded-[10px] border border-slate-200 bg-slate-100 p-[3px]">
              {STATUS_FILTERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFilter({ status: option.id })}
                  className={cn(
                    "rounded-[7px] px-3.5 py-1.5 text-[12.6px] font-semibold transition-colors",
                    filters.status === option.id ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.1)]" : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          <select className={SELECT} value={filters.designId} onChange={(event) => setFilter({ designId: event.target.value })} aria-label="Filter by design">
            <option value="">All designs</option>
            {designs.map((design) => (
              <option key={design.id} value={design.id}>
                {design.code} · {design.name}
              </option>
            ))}
          </select>
          {tab === "stock" && (
            <select className={SELECT} value={filters.sort} onChange={(event) => setFilter({ sort: event.target.value })} aria-label="Sort">
              {SORTS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
          {hasAnyFilter && (
            <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)} className="px-1.5 py-2 text-[13px] text-slate-500 hover:text-slate-900">
              Clear filters
            </button>
          )}
          <span className="ml-auto text-[12.5px] text-slate-400">{countLabel}</span>
        </div>

        <div className="mt-4">
          {tab === "stock" && (
            <StockTable
              variants={filtered}
              expanded={expanded}
              forceOpen={isFiltered}
              onToggle={(designId) => setExpanded((current) => ({ ...current, [designId]: !current[designId] }))}
              onOpen={openDrawer}
            />
          )}
          {tab === "matrix" && <SizeMatrix variants={filtered} />}
          {tab === "log" && (
            <AdjustmentLog
              entries={filteredAdjustments}
              isLoading={adjustmentsQuery.isLoading}
              error={adjustmentsQuery.error}
              onReverse={setReverseEntry}
            />
          )}
        </div>
      </Sheet>

      {drawerVariantId && (
        <VariantDrawer
          colorVariantId={drawerVariantId}
          ageingDays={overview?.ageingDays ?? 60}
          onClose={closeDrawer}
          onAddStock={(colorVariantId) => setAddStockFor(colorVariantId)}
        />
      )}

      {addStockFor !== undefined && (
        <AddStockDialog variants={variants} initialVariantId={addStockFor} onClose={() => setAddStockFor(undefined)} />
      )}

      {reverseEntry && <ReverseDialog entry={reverseEntry} onClose={() => setReverseEntry(null)} />}

      {isPrinting && <PrintReport variants={filtered} asOn={overview?.asOn} isFiltered={isFiltered} onClose={closePrint} />}
    </div>
  );
};

export default CurrentStock;
