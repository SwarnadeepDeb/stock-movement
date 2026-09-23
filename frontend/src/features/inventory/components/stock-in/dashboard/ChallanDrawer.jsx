import { useEffect } from "react";
import { AlertTriangle, Ban, Check, Download, Loader2, Lock, Pencil, Printer, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStockInChallanApi } from "../../../hooks/useStockInChallansApi";
import { formatDateOnly, formatHistoryDateParts } from "../../../utils/stockHistoryLabels";

const Field = ({ label, children, mono, wide }) => (
  <div className={cn(wide && "col-span-2 sm:col-span-3")}>
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
    <div className={cn("mt-0.5 text-[13px] text-slate-900", mono && "font-mono")}>{children}</div>
  </div>
);

const Section = ({ title, children }) => (
  <section className="mt-6 first:mt-0">
    {title && <div className="mb-2.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">{title}</div>}
    {children}
  </section>
);

const Tag = ({ className, children }) => (
  <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-wide", className)}>{children}</span>
);

// Per-design/variant stock count: sets, semi sets (with their sizes), loose pieces, total.
const StockCountTable = ({ challan }) => {
  const groups = [...new Set(challan.lines.map((line) => line.designCode))];
  const dash = <span className="text-slate-300">–</span>;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[420px] text-xs">
        <thead className="border-b border-slate-200 bg-slate-50 text-[9.5px] uppercase tracking-wider text-slate-400">
          <tr>
            <th className="p-2.5 text-left">Design · variant</th>
            <th className="p-2.5">Sets</th>
            <th className="p-2.5">Semi sets</th>
            <th className="p-2.5">Loose</th>
            <th className="p-2.5">Total pcs</th>
          </tr>
        </thead>
        <tbody>
          {groups.flatMap((code) => {
            const lines = challan.lines.filter((line) => line.designCode === code);
            return [
              <tr key={`d-${code}`} className="bg-slate-100 text-[11.5px] font-bold text-slate-800">
                <td colSpan={5} className="px-2.5 py-1.5">{code} · {lines[0].designName}</td>
              </tr>,
              ...lines.map((line) => (
                <tr key={line.transactionId} className="border-b border-slate-100 text-center font-mono">
                  <td className="p-2.5 text-left font-sans">
                    <span className="mr-2 inline-block size-2 rounded-full" style={{ backgroundColor: line.colorHex }} />
                    {line.colorName}
                  </td>
                  <td>{line.sets || dash}</td>
                  <td>
                    {line.semiSetCount || dash}
                    {line.semiSets.length > 0 && (
                      <div className="font-sans text-[10px] text-slate-500">
                        {line.semiSets.map((semi) => `${semi.quantity} × ${semi.sizes.join("-")}`).join(", ")}
                      </div>
                    )}
                  </td>
                  <td>{line.loosePieces || dash}</td>
                  <td className="font-bold">{line.pieces}</td>
                </tr>
              )),
            ];
          })}
          <tr className="border-t border-slate-300 bg-emerald-50 text-center font-mono font-bold">
            <td className="p-2.5 text-left font-sans">Total</td>
            <td>{challan.sets}</td>
            <td>{challan.semiSets}</td>
            <td>{challan.loosePieces}</td>
            <td>{challan.totalPieces}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

const EVENT_LABEL = { PRINT: "Printed", PDF: "PDF downloaded", EDIT: "Edited", DROP: "Dropped" };

const ChallanDrawer = ({ challanId, onClose, onEdit, onDrop, onPreview, onDownload }) => {
  const { data, isLoading, isError, error } = useStockInChallanApi(challanId);
  const challan = data?.data;
  const open = Boolean(challanId);
  const dropped = challan?.status === "DROPPED";

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const history = challan
    ? [
        { at: challan.createdAt, text: <>Entered{challan.enteredBy ? <> by <b>{challan.enteredBy}</b></> : null}</> },
        ...challan.events.map((event) => ({
          at: event.createdAt,
          text: (
            <>
              {EVENT_LABEL[event.kind] ?? event.kind}
              {event.actor ? <> by <b>{event.actor}</b></> : null}
              {event.note ? <> — {event.note}</> : null}
              {event.changes?.length > 0 && (
                <div className="mt-0.5 text-xs text-slate-600">
                  {event.changes.map((change) => (
                    <div key={change.field}>
                      {change.field}: <s className="text-slate-400">{change.from || "—"}</s> → <b>{change.to || "—"}</b>
                    </div>
                  ))}
                </div>
              )}
            </>
          ),
        })),
      ].sort((a, b) => new Date(a.at) - new Date(b.at))
    : [];

  return (
    <>
      <div
        onClick={onClose}
        className={cn("fixed inset-0 z-40 bg-slate-900/40 transition-opacity", open ? "opacity-100" : "pointer-events-none opacity-0")}
      />
      <aside
        role="dialog"
        aria-label="Challan details"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[720px] flex-col bg-white shadow-2xl transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
              Sr. no. {challan?.serialLabel ?? "…"}{dropped ? " · DROPPED" : ""} · jobber challan
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-lg font-bold text-slate-900">
              {challan?.challanNo ?? "—"}
              {dropped && <Tag className="border-red-200 bg-red-50 text-red-600">DROPPED</Tag>}
              {challan?.edited && <Tag className="border-blue-200 bg-blue-50 text-blue-700">EDITED</Tag>}
            </div>
            {challan && (
              <div className="mt-0.5 text-[13px] text-slate-500">
                {challan.jobberName ?? "—"} · {formatDateOnly(challan.stockDate)} · {challan.totalPieces} pcs
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          )}
          {isError && <div className="py-10 text-center text-sm text-red-600">{error.message}</div>}

          {challan && (
            <>
              {dropped && (
                <Section>
                  <div className="flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-900">
                    <Ban className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <b>Dropped</b> — {challan.voidReason}. Serial no. <b>{challan.serialLabel}</b> is retired and will never be reused. Its stock was
                      removed and its QR tags retired.
                    </div>
                  </div>
                </Section>
              )}

              <Section>
                <div className="grid grid-cols-2 gap-x-5 gap-y-3.5 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
                  <Field label="Serial no." mono>{challan.serialLabel}</Field>
                  <Field label="Jobber">{challan.jobberName ?? "—"}</Field>
                  <Field label="Jobber challan no." mono>{challan.challanNo}</Field>
                  <Field label="Inward date">{formatDateOnly(challan.stockDate)}</Field>
                  <Field label="Issued challan no." mono>{challan.issuedChallanNo || <span className="text-slate-400">Not recorded</span>}</Field>
                  <Field label="Entered by">{challan.enteredBy ?? "—"}</Field>
                  <Field label="QC inspection remarks" wide>{challan.remarks || <span className="text-slate-400">None</span>}</Field>
                </div>
              </Section>

              <Section title="Stock count">
                <StockCountTable challan={challan} />
              </Section>

              <Section title="QC">
                {challan.lines.some((line) => line.defective > 0) ? (
                  <div className="space-y-2">
                    {challan.lines.filter((line) => line.defective > 0).map((line) => (
                      <div key={line.transactionId} className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        <div>
                          <b>{line.designCode} {line.colorName}</b>: {line.defective} defective · {line.defectCategory}
                          {challan.defectAction && <> · {challan.defectAction === "return" ? "Returned to jobber" : "Moved to factory seconds"}</>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[13px] text-emerald-900">
                    <Check className="mt-0.5 size-4 shrink-0" /> All {challan.totalPieces} pieces passed QC.
                  </div>
                )}
              </Section>

              <Section>
                <details open={challan.edited || dropped} className="group">
                  <summary className="cursor-pointer text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                    History · {history.length} entr{history.length === 1 ? "y" : "ies"}
                  </summary>
                  <div className="mt-2">
                    {history.map((entry, index) => {
                      const parts = formatHistoryDateParts(entry.at);
                      return (
                        <div key={index} className="grid grid-cols-[88px_1fr] gap-3 border-b border-dashed border-slate-200 py-2 text-[13px] last:border-0">
                          <span className="text-xs text-slate-400">{parts.date}<br />{parts.time}</span>
                          <div>{entry.text}</div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              </Section>
            </>
          )}
        </div>

        {challan && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:px-6">
            <Button type="button" variant="outline" size="sm" onClick={() => onPreview(challan)} className="gap-1.5"><Printer className="size-3.5" /> Print</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onDownload(challan)} className="gap-1.5"><Download className="size-3.5" /> Download PDF</Button>
            <span className="flex-1" />
            {dropped ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-500"><Lock className="size-3" /> Dropped challans are read-only</span>
            ) : (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => onEdit(challan)} className="gap-1.5"><Pencil className="size-3.5" /> Edit details</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => onDrop(challan)} className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50"><Ban className="size-3.5" /> Drop challan</Button>
              </>
            )}
          </div>
        )}
      </aside>
    </>
  );
};

export default ChallanDrawer;
