import { useState } from "react";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router";

import DataTable from "@/components/shared/table/DataTable";
import { Button } from "@/components/ui/button";
import { useCurrentStockDetailApi } from "../hooks/useCurrentStockDetailApi";
import { columns } from "../table/CurrentStockDetailColumns";
import BundleCompositionCard from "../components/BundleCompositionCard";
import CurrentStockScopeSelector, { TOTAL_SCOPE } from "../components/CurrentStockScopeSelector";

const MetricTile = ({ label, value, emphasize }) => (
  <div className="neu-button flex flex-col gap-1 rounded-xl px-4 py-3">
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
    <span className={emphasize ? "text-2xl font-bold text-[#1E1B4B]" : "text-lg font-semibold text-foreground"}>
      {value}
    </span>
  </div>
);

const CurrentStockDetail = () => {
  const { colorVariantId } = useParams();
  const [searchParams] = useSearchParams();
  // Set by the Current Stock list's row-level view action (CurrentStockRowActions): a design row
  // represents every variant combined, so it links in with ?scope=total to open Total by default
  // instead of the arbitrary variant its link had to use as the route's entry point. A variant
  // chip's own link (CurrentStockVariantChip) carries no such param, so it still defaults to that
  // variant via detail.selectedColorVariantId below.
  const requestsTotalByDefault = searchParams.get("scope")?.toLowerCase() === "total";

  const { data: response, isPending, isError, error, refetch } = useCurrentStockDetailApi(colorVariantId);
  const detail = response?.data;

  // selectedScope: null = "no explicit choice yet" → defaults per requestsTotalByDefault above, or
  // otherwise to whichever variant the page was opened from (detail.selectedColorVariantId,
  // echoing the route's :colorVariantId), or Total if that's somehow absent. Reset during render
  // (not an effect) whenever the route itself points at a different variant, since the API
  // response — and its default — changes with it; this is React's documented "adjusting state when
  // a prop changes" pattern.
  const [scopeState, setScopeState] = useState({ forColorVariantId: colorVariantId, selectedScope: null });

  if (scopeState.forColorVariantId !== colorVariantId) {
    setScopeState({ forColorVariantId: colorVariantId, selectedScope: null });
  }

  const scope = scopeState.selectedScope
    ?? (requestsTotalByDefault ? TOTAL_SCOPE : detail?.selectedColorVariantId)
    ?? TOTAL_SCOPE;
  const setSelectedScope = (nextScope) => setScopeState({ forColorVariantId: colorVariantId, selectedScope: nextScope });

  const activeStock = detail && (
    scope === TOTAL_SCOPE
      ? detail.total
      : detail.variants.find((variant) => variant.colorVariantId === scope)
  );

  // Design Master already establishes "first variant's image represents the whole design" (see
  // design.service.js's setComposition + the Current Stock list's design-row thumbnail) — reused
  // here for the Total scope, which has no single variant image of its own.
  const headerImageUrl = detail && (scope === TOTAL_SCOPE ? detail.variants[0]?.imageUrl : activeStock?.imageUrl);

  return (
    <div className="flex flex-col font-sans space-y-6">
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" className="w-fit text-muted-foreground">
          <Link to="/current-stock" className="inline-flex items-center gap-1.5">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>

        <h1 className="text-3xl font-bold text-[#1E1B4B] tracking-tight">Current Stock Detail</h1>
      </div>

      {isPending && (
        <p className="flex items-center justify-center gap-2 rounded-2xl border border-border py-16 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Loading stock details...
        </p>
      )}

      {!isPending && isError && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {error?.message ?? "Unable to load stock details. Please try again."}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}

      {!isPending && !isError && detail && activeStock && (
        <>
          {/* Design identity + stock scope selector (variants + Total) — replaces the old
              single always-one-variant color line now that this page covers the whole design. */}
          <div className="flex flex-col gap-3 rounded-2xl p-3">
            <div className="flex items-center gap-3">
              <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                {headerImageUrl && (
                  <img
                    src={headerImageUrl}
                    alt={detail.design.name}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <span className="truncate text-lg font-bold text-[#1E1B4B]">
                {detail.design.code ? `${detail.design.code} · ` : ""}
                {detail.design.name}
              </span>
            </div>

            <CurrentStockScopeSelector
              variants={detail.variants}
              selectedScope={scope}
              onSelect={setSelectedScope}
            />
          </div>

          {/* Compact metrics — subtle neumorphic tiles, Total Pieces emphasized */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricTile label="Total Pieces" value={activeStock.totals.totalPieces} emphasize />
            <MetricTile label="Set Pieces" value={activeStock.totals.setPieces} />
            <MetricTile label="Bundle Pieces" value={activeStock.totals.bundlePieces} />
            <MetricTile label="Loose Pieces" value={activeStock.totals.loosePieces} />
          </div>

          {/* Stock by Size + Bundle Compositions — side by side on desktop, stacked below.
              Bounded height at lg+ so the Bundle Compositions list scrolls internally instead of
              growing the whole page and pushing the Total footer down; below lg both sections
              stack and grow naturally with the page, same as before. */}
          <div className="grid grid-cols-1 gap-4 lg:h-[clamp(24rem,60vh,36rem)] lg:grid-cols-[1fr_320px]">
            <section className="flex min-w-0 min-h-0 flex-col gap-2">
              <h2 className="text-sm font-semibold text-foreground">Stock by Size</h2>

              <div className="min-h-0 flex-1">
                <DataTable
                  columns={columns}
                  data={activeStock.sizes}
                  emptyState={{
                    title: "No active sizes configured",
                    description: "This variant has no active sizes to show stock for.",
                  }}
                />
              </div>

              {activeStock.sizes.length > 0 && (
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-4 py-2.5 sm:px-6">
                  <span className="text-sm font-semibold text-foreground">Total</span>
                  <div className="grid grid-cols-4 gap-3 text-right sm:gap-6">
                    {[
                      ["Set", activeStock.totals.setPieces],
                      ["Bundle", activeStock.totals.bundlePieces],
                      ["Loose", activeStock.totals.loosePieces],
                      ["Total", activeStock.totals.totalPieces],
                    ].map(([label, value]) => (
                      <div key={label} className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
                        <span className="text-sm font-semibold tabular-nums text-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="flex min-w-0 min-h-0 flex-col gap-2">
              <h2 className="text-sm font-semibold text-foreground">Bundle Compositions</h2>

              {activeStock.compositions.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No bundles currently in stock.
                </p>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(30,27,75,0.25)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#1E1B4B]/25">
                  <div className="flex flex-col gap-3">
                    {activeStock.compositions.map((composition, index) => (
                      <BundleCompositionCard key={composition.stockGroupId} index={index} composition={composition} />
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
};

export default CurrentStockDetail;
