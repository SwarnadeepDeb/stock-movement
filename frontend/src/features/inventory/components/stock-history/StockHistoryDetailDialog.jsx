import { useMemo, useState } from "react";
import { Loader2Icon } from "lucide-react";

import ActionModal from "@/components/shared/ActionModal";
import { Badge } from "@/components/ui/badge";
import { useColorVariantSizesApi } from "../../hooks/useColorVariantSizesApi";
import { formatDateOnly, formatHistoryDateTime, getEventTypeLabel } from "../../utils/stockHistoryLabels";

const Section = ({ title, children }) => (
  <div className="flex flex-col gap-2">
    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
    {children}
  </div>
);

const CompositionList = ({ composition, resolveSizeLabel }) => (
  <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-3">
    {composition.map((piece) => (
      <div key={piece.designSizeId} className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{resolveSizeLabel(piece.designSizeId)}</span>
        <span className="font-medium tabular-nums text-foreground">× {piece.quantity}</span>
      </div>
    ))}
  </div>
);

// Backend only stores designSizeId in metadata (see stockHistory.service.js) — sizeLabel is
// resolved here via the variant's existing active-sizes endpoint, not fabricated. A size
// deactivated after the event happened won't resolve and falls back to its raw id, same as
// currentStock.service.js's own composition-label fallback.
const StockInDetail = ({ item, resolveSizeLabel }) => {
  const { totalSetsReceived, bundles = [], loosePieces = [], sizeBreakdown = [] } = item.metadata ?? {};

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-foreground">{item.quantity} pieces added</p>

      {(item.stockDate || item.challanNo) && (
        <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-muted/30 p-3">
          {item.stockDate && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Delivery Date</span>
              <span className="text-sm font-medium text-foreground">{formatDateOnly(item.stockDate)}</span>
            </div>
          )}
          {item.challanNo && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Challan No.</span>
              <span className="text-sm font-medium text-foreground">{item.challanNo}</span>
            </div>
          )}
        </div>
      )}

      {totalSetsReceived > 0 && (
        <Section title="Sets Received">
          <p className="text-sm font-medium text-foreground">{totalSetsReceived}</p>
        </Section>
      )}

      {bundles.length > 0 && (
        <Section title="Bundles Received">
          <div className="flex flex-col gap-3">
            {bundles.map((bundle) => (
              <div key={bundle.bundleNumber} className="flex flex-col gap-1.5">
                <span className="text-sm text-foreground">
                  Bundle #{bundle.bundleNumber} · {bundle.quantity} bundle{bundle.quantity === 1 ? "" : "s"}
                </span>
                <CompositionList composition={bundle.composition} resolveSizeLabel={resolveSizeLabel} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {loosePieces.length > 0 && (
        <Section title="Loose Pieces">
          <CompositionList composition={loosePieces} resolveSizeLabel={resolveSizeLabel} />
        </Section>
      )}

      {sizeBreakdown.length > 0 && (
        <Section title="Size Breakdown">
          <CompositionList
            composition={sizeBreakdown.map((row) => ({ designSizeId: row.designSizeId, quantity: row.quantityAdded }))}
            resolveSizeLabel={resolveSizeLabel}
          />
        </Section>
      )}
    </div>
  );
};

// Shared body for SET_ASSEMBLED/BUNDLE_ASSEMBLED — same shape, different metadata key for
// composition (sourceComposition vs composition) and different unit label.
const AssembledDetail = ({ item, resolveSizeLabel, unitLabel }) => {
  const metadata = item.metadata ?? {};
  const composition = metadata.sourceComposition ?? metadata.composition ?? [];
  const sourceStockItemIds = metadata.sourceStockItemIds ?? [];
  // Bulk transformations store every created unit in resultStockItemIds; a single-unit event
  // (assembleBundle, or an assembleSet call from before bulk support) only ever had the
  // singular resultStockItemId — fall back to that so older rows still render.
  const resultStockItemIds = metadata.resultStockItemIds ?? (metadata.resultStockItemId ? [metadata.resultStockItemId] : []);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-foreground">
        {item.quantity} {unitLabel}
        {item.quantity === 1 ? "" : "s"}
      </p>

      {composition.length > 0 && (
        <Section title="Composition">
          <CompositionList composition={composition} resolveSizeLabel={resolveSizeLabel} />
        </Section>
      )}

      {sourceStockItemIds.length > 0 && (
        <Section title="Source Stock">
          <div className="flex flex-wrap gap-1.5">
            {sourceStockItemIds.map((id) => (
              <Badge key={id} variant="outline">
                Stock Item #{id}
              </Badge>
            ))}
          </div>
        </Section>
      )}

      {resultStockItemIds.length > 0 && (
        <Section title="Result">
          <div className="flex flex-wrap gap-1.5">
            {resultStockItemIds.map((id) => (
              <Badge key={id} variant="outline">
                {unitLabel} #{id}
              </Badge>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
};

// Opened via useModal (same mechanism as QrPreviewDialog/AddBundleDialog) — manages only its
// own open/close animation state; all event data comes from the row it was opened for.
const StockHistoryDetailDialog = ({ item, onClose }) => {
  const [open, setOpen] = useState(true);

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      setTimeout(onClose, 150);
    }
  };

  const { data: sizesResponse, isFetching } = useColorVariantSizesApi({ colorVariantId: item.colorVariantId });

  const resolveSizeLabel = useMemo(() => {
    const sizeLabelById = new Map((sizesResponse?.data ?? []).map((size) => [size.id, size.sizeLabel]));
    return (designSizeId) => sizeLabelById.get(designSizeId) ?? `Size #${designSizeId}`;
  }, [sizesResponse]);

  return (
    <ActionModal openActionModal={open} setOpenActionModal={handleOpenChange} title={getEventTypeLabel(item.eventType)}>
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">
            {item.designCode ? `${item.designCode} · ` : ""}
            {item.designName}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <span
              className="size-2.5 shrink-0 rounded-full border border-black/10"
              style={{ backgroundColor: item.colorHex }}
            />
            {item.colorName}
          </span>
        </div>

        {isFetching ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading details...
          </div>
        ) : (
          <>
            {item.eventType === "STOCK_IN" && <StockInDetail item={item} resolveSizeLabel={resolveSizeLabel} />}
            {item.eventType === "SET_ASSEMBLED" && (
              <AssembledDetail item={item} resolveSizeLabel={resolveSizeLabel} unitLabel="Set" />
            )}
            {item.eventType === "BUNDLE_ASSEMBLED" && (
              <AssembledDetail item={item} resolveSizeLabel={resolveSizeLabel} unitLabel="Bundle" />
            )}
          </>
        )}

        <span className="text-xs text-muted-foreground">{formatHistoryDateTime(item.createdAt)}</span>
      </div>
    </ActionModal>
  );
};

export default StockHistoryDetailDialog;
