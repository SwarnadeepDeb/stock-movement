import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useDesignInfiniteListApi } from "../hooks/useDesignListApi";
import DesignCard from "../components/dashboard/DesignCard";
import DesignPreviewDrawer from "../components/dashboard/DesignPreviewDrawer";

const PAGE_SIZE = 24;
const SORTS = [
  ["new", "Newest first"],
  ["old", "Oldest first"],
  ["price_asc", "Price: low to high"],
  ["price_desc", "Price: high to low"],
  ["code", "Design code A–Z"],
];

const Sheet = ({ children, className = "" }) => (
  <section className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] md:p-7 ${className}`}>{children}</section>
);

// Design Master dashboard: every registered design as a card — search, sort, preview & share
// the photos, or jump into editing. Search/sort run on the server so they cover every design.
const Designs = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("new");
  const [previewId, setPreviewId] = useState(null);

  const keyword = useDebouncedValue(query.trim(), 300);
  const listQuery = useDesignInfiniteListApi({ limit: PAGE_SIZE, keyword: keyword || undefined, sort });
  const designs = useMemo(() => listQuery.data?.pages.flatMap((page) => page.data) ?? [], [listQuery.data]);
  const meta = listQuery.data?.pages.at(-1)?.meta;
  const hasFilters = Boolean(query.trim()) || sort !== "new";

  const editDesign = (design) => navigate(`/designs/${design.id}/edit`);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <Sheet>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight text-slate-900">Design Master</h1>
            <p className="mt-1 max-w-[70ch] text-sm text-slate-500">
              Every registered design, its set composition and colour variants — preview, share or edit any of them right from here.
            </p>
          </div>
          <Button type="button" onClick={() => navigate("/add-designs")} className="gap-2 rounded-full bg-emerald-600 px-5 text-[13.5px] font-semibold text-white hover:bg-emerald-700">
            <Plus className="size-4" /> Register New Design
          </Button>
        </div>
      </Sheet>

      <Sheet>
        <div className="relative">
          <Search className="pointer-events-none absolute left-[18px] top-1/2 size-[19px] -translate-y-1/2 text-emerald-600" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by design code, item name, jobber, pattern, quality or variant colour"
            className="w-full rounded-[13px] border-2 border-emerald-200 bg-emerald-50 py-3.5 pl-12 pr-4 font-mono text-[14.5px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            aria-label="Sort designs"
            className="cursor-pointer rounded-[9px] border-[1.5px] border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-emerald-500"
          >
            {SORTS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {hasFilters && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("");
                setSort("new");
              }}
              className="rounded-full text-xs"
            >
              Clear filters
            </Button>
          )}
          <span className="ml-auto flex items-center gap-2 text-[12.5px] text-slate-400">
            {listQuery.isFetching && !listQuery.isFetchingNextPage && <Loader2 className="size-3.5 animate-spin" />}
            {meta ? `${meta.total} of ${meta.totalAll} designs` : ""}
          </span>
        </div>
      </Sheet>

      <Sheet>
        {listQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> Loading designs…
          </div>
        ) : listQuery.isError ? (
          <div className="py-16 text-center text-sm">
            <p className="text-red-600">{listQuery.error.message}</p>
            <Button type="button" variant="outline" className="mt-3" onClick={() => listQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : designs.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            <b className="mb-1 block text-[15px] text-slate-900">{hasFilters ? "No designs match" : "No designs yet"}</b>
            {hasFilters ? "Try a different search, or register a new design." : "Register your first design to get started."}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-[18px]">
              {designs.map((design) => (
                <DesignCard key={design.id} design={design} onEdit={editDesign} onShowDetails={(item) => setPreviewId(item.id)} />
              ))}
            </div>
            {listQuery.hasNextPage && (
              <div className="mt-5 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => listQuery.fetchNextPage()}
                  disabled={listQuery.isFetchingNextPage}
                  className="gap-2 rounded-full"
                >
                  {listQuery.isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
                  Load more designs
                </Button>
              </div>
            )}
          </>
        )}
      </Sheet>

      {previewId && (
        <DesignPreviewDrawer
          designId={previewId}
          onClose={() => setPreviewId(null)}
          onEdit={(design) => {
            setPreviewId(null);
            editDesign(design);
          }}
        />
      )}
    </div>
  );
};

export default Designs;
