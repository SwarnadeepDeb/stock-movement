import { flushSync } from "react-dom";
import { ArrowLeftIcon, Loader2Icon, PrinterIcon } from "lucide-react";
import { Link, useParams } from "react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useModal } from "@/components/shared/ModalProvider";
import { useQrCenterRegistrationDetailApi } from "../hooks/useQrCenterRegistrationDetailApi";
import QrPrintSheet, { QrLabelCard } from "../components/qr-center/QrPrintSheet";
import QrPreviewDialog from "../components/qr-center/QrPreviewDialog";
import { formatDateOnly } from "../utils/stockHistoryLabels";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

// registration.stockDate is a date-only "YYYY-MM-DD" (Delivery Date) — formatted via
// formatDateOnly so it never shifts a day from a UTC reparse. createdAt is a full timestamp
// fallback (transformations have no stockDate) and formats normally.
function formatRegistrationDate(registration) {
  return registration.stockDate
    ? formatDateOnly(registration.stockDate)
    : dateFormatter.format(new Date(registration.createdAt));
}

const MetricTile = ({ label, value, emphasize }) => (
  <div className="neu-button flex flex-col gap-1 rounded-xl px-4 py-3">
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
    <span className={emphasize ? "text-2xl font-bold text-[#1E1B4B]" : "text-lg font-semibold text-foreground"}>
      {value}
    </span>
  </div>
);

// Flattens the registration's design/variant identity into every QR row so the same view
// model already understood by QrPreviewDialog/QrLabelCard/QrPrintSheet (built for the old
// per-stock-item QR Center) works unchanged here — no second QR rendering path.
function toLabelItems(registration, qrs) {
  return qrs.map((qr) => ({
    stockItemId: qr.stockItemId,
    type: qr.type,
    designCode: registration.design.code,
    designName: registration.design.name,
    colorName: registration.variant.colorName,
    colorHex: registration.variant.colorHex,
    qr: { payload: qr.payload, generatedAt: qr.generatedAt },
  }));
}

const QrGrid = () => {
  const { stockInTransactionId, transformationId } = useParams();
  const registrationType = transformationId ? "TRANSFORMATION" : "STOCK_IN";
  const registrationId = transformationId ?? stockInTransactionId;

  const { openModal } = useModal();
  const [printItems, setPrintItems] = useState([]);

  const { data: response, isPending, isError, error, refetch } = useQrCenterRegistrationDetailApi({ registrationType, registrationId });
  const registration = response?.data?.registration;
  const qrs = response?.data?.qrs ?? [];
  const labelItems = registration ? toLabelItems(registration, qrs) : [];

  // Printing needs the DOM committed before window.print() reads it — flushSync makes that
  // synchronous instead of racing a setState against the print call (same pattern the old
  // QrCenter page used for per-row/selection printing).
  const handlePrint = (items) => {
    flushSync(() => setPrintItems(items));
    window.print();
  };

  return (
    <div className="flex flex-col font-sans space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className="w-fit text-muted-foreground">
            <Link to="/qr-center" className="inline-flex items-center gap-1.5">
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>

          <h1 className="text-3xl font-bold text-[#1E1B4B] tracking-tight">QR Grid</h1>
        </div>

        {labelItems.length > 0 && (
          <Button type="button" onClick={() => handlePrint(labelItems)}>
            <PrinterIcon className="size-4" />
            Print All
          </Button>
        )}
      </div>

      {isPending && (
        <p className="flex items-center justify-center gap-2 rounded-2xl border border-border py-16 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Loading QR codes...
        </p>
      )}

      {!isPending && isError && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {error?.message ?? "Unable to load this registration. Please try again."}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}

      {!isPending && !isError && registration && (
        <>
          {/* Stock Registration identity — design/variant/date, same compact card pattern as
              CurrentStockDetail's header. */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl p-3">
            <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
              {registration.variant.imageUrl && (
                <img
                  src={registration.variant.imageUrl}
                  alt={registration.variant.colorName}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-lg font-bold text-[#1E1B4B]">
                {registration.registrationType === "TRANSFORMATION"
                  ? `Transformation #${registration.registrationId}`
                  : `Stock In #${registration.registrationId}`}
              </span>
              <span className="inline-flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                {registration.design.code ? `${registration.design.code} · ` : ""}
                {registration.design.name}
                <span
                  className="size-2.5 shrink-0 rounded-full border border-black/10"
                  style={{ backgroundColor: registration.variant.colorHex }}
                />
                {registration.variant.colorName}
              </span>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {registration.challanNo && <Badge variant="outline">Challan: {registration.challanNo}</Badge>}
              <Badge variant="outline">{formatRegistrationDate(registration)}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricTile label="Total QRs" value={registration.totalQrCount} emphasize />
          </div>

          <section className="flex min-w-0 flex-col gap-2">
            <h2 className="text-sm font-semibold text-foreground">QR Labels</h2>

            {labelItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No QR codes have been generated for this registration yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {labelItems.map((item) => (
                  <button
                    key={item.stockItemId}
                    type="button"
                    className="text-left"
                    onClick={() => openModal(QrPreviewDialog, { item, onPrint: () => handlePrint([item]) })}
                  >
                    <QrLabelCard item={item} className="bg-white transition-shadow hover:shadow-md" />
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <QrPrintSheet items={printItems} />
    </div>
  );
};

export default QrGrid;
