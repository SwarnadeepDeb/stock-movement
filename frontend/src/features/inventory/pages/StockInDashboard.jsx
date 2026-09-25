import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { ArrowRight, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import ActionModal from "@/components/shared/ActionModal";
import { cn } from "@/lib/utils";
import { STOCK_IN_STEPS } from "../hooks/useStockInWizard";
import { useStockInDashboardApi } from "../hooks/useStockInDashboardApi";
import { useDeleteStockInDraftApi, useStockInDraftsApi } from "../hooks/useStockInDraftsApi";
import { useLogStockInChallanEventApi, useNextStockInSerialApi } from "../hooks/useStockInChallansApi";
import { getStockInChallanApi } from "../services/stockInChallan.api";
import { buildChallanPdf, challanFileName, downloadBlob } from "../utils/challanPdf";
import { formatDateOnly } from "../utils/stockHistoryLabels";
import { DEFAULT_CHALLAN_FILTERS as DEFAULT_FILTERS } from "../utils/challanFilters";
import ChallanRegister from "../components/stock-in/dashboard/ChallanRegister";
import JobberSummary from "../components/stock-in/dashboard/JobberSummary";
import ChallanDrawer from "../components/stock-in/dashboard/ChallanDrawer";
import ChallanPdfPreview from "../components/stock-in/dashboard/ChallanPdfPreview";
import EditChallanDialog from "../components/stock-in/dashboard/EditChallanDialog";
import DropChallanDialog from "../components/stock-in/dashboard/DropChallanDialog";

const Sheet = ({ className, children }) => (
  <section className={cn("rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] md:p-8", className)}>
    {children}
  </section>
);

const Stat = ({ value, label, highlight }) => (
  <div className="flex-1 basis-1/2 border-b border-slate-200 px-5 py-3.5 md:basis-0 md:border-b-0 md:border-r md:last:border-r-0">
    <div className={cn("font-mono text-xl font-bold", highlight ? "text-amber-700" : "text-slate-900")}>{value ?? "—"}</div>
    <div className="mt-0.5 text-[11px] text-slate-500">{label}</div>
  </div>
);

const TABS = [
  ["register", "Challan register"],
  ["jobbers", "Jobber summary"],
];

function draftTitle(draft) {
  return draft.challanNo || null;
}

const StockInDashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dashboardQuery = useStockInDashboardApi();
  const draftsQuery = useStockInDraftsApi();
  const nextSerialQuery = useNextStockInSerialApi();
  const { mutateAsync: deleteDraft, isPending: isDeleting } = useDeleteStockInDraftApi();
  const { mutate: logEvent } = useLogStockInChallanEventApi();

  const [tab, setTab] = useState("register");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [drawerId, setDrawerId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [dropping, setDropping] = useState(null);
  const [previewing, setPreviewing] = useState(null);
  const [draftToDiscard, setDraftToDiscard] = useState(null);

  const stats = dashboardQuery.data?.data?.stats;
  const drafts = draftsQuery.data?.data ?? [];
  const nextSerial = nextSerialQuery.data?.data?.serial;

  const closeDrawer = useCallback(() => setDrawerId(null), []);

  // Register rows only carry the summary; the challan PDF needs the per-design breakdown too.
  const loadDetail = useCallback(
    async (challan) => (challan.lines ? challan : (await queryClient.fetchQuery({ queryKey: ["stock-in", "challan", challan.id], queryFn: () => getStockInChallanApi(challan.id), staleTime: 0 })).data),
    [queryClient],
  );

  const handlePreview = async (challan) => {
    try {
      setPreviewing(await loadDetail(challan));
    } catch (error) {
      toast.error(error?.message ?? "Couldn't open the challan.");
    }
  };

  const handleDownload = async (challan) => {
    try {
      const detail = await loadDetail(challan);
      const { doc, pageCount } = buildChallanPdf(detail);
      downloadBlob(doc.output("blob"), challanFileName(detail, "pdf"));
      logEvent({ id: detail.id, kind: "PDF" });
      toast.success(`Downloaded ${challanFileName(detail, "pdf")} (${pageCount} page${pageCount > 1 ? "s" : ""}, 148 × 210 mm)`);
    } catch (error) {
      toast.error(error?.message ?? "Couldn't build the PDF.");
    }
  };

  const handleConfirmDiscard = async () => {
    if (!draftToDiscard) return;
    try {
      await deleteDraft(draftToDiscard.id);
      toast.success(`Draft #${draftToDiscard.id} discarded.`);
      setDraftToDiscard(null);
    } catch (error) {
      toast.error(error?.message ?? "Couldn't discard draft. Please try again.");
    }
  };

  const openJobber = (jobberName) => {
    setFilters({ ...DEFAULT_FILTERS, jobber: jobberName });
    setTab("register");
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <Sheet>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Stock In</h1>
          </div>
          <Button type="button" onClick={() => navigate("/stock-in/new")} className="gap-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700">
            <Plus className="size-4" /> New Stock Inward
          </Button>
        </div>

        <div className="mt-5 flex flex-wrap overflow-hidden rounded-xl border border-slate-200 bg-slate-50 md:flex-nowrap">
          <Stat value={stats?.batchesThisMonth} label="Batches this month" />
          <Stat value={stats?.piecesThisMonth?.toLocaleString("en-IN")} label="Pieces logged this month" />
          <Stat value={stats?.draftsInProgress} label="Drafts in progress" highlight={stats?.draftsInProgress > 0} />
          <Stat value={stats?.batchesPendingPrint} label="Batches with tags pending print" highlight={stats?.batchesPendingPrint > 0} />
        </div>
        {dashboardQuery.isError && <div className="pt-3 text-center text-sm text-red-600">{dashboardQuery.error.message}</div>}
      </Sheet>

      {drafts.length > 0 && (
        <Sheet>
          <h2 className="text-base font-bold text-slate-900">Continue a draft</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-slate-500 md:text-[13px]">
            Not added to stock yet — continue where you left off. A serial no. is issued only when the stock-in is completed.
          </p>
          <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
            {drafts.map((draft) => {
              const step = Math.min(Math.max(draft.currentStep, 0), STOCK_IN_STEPS.length - 1);
              return (
                <div key={draft.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 px-4 py-3">
                  <div className="min-w-0 flex-1 basis-60">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="truncate font-mono text-[12.8px] font-bold text-slate-900">
                        {draftTitle(draft) ?? <span className="font-sans font-medium text-slate-500">Challan no. not entered yet</span>}
                      </span>
                      <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold text-slate-500">Draft #{draft.id}</span>
                    </div>
                    <div className="mt-0.5 text-[11.6px] text-slate-400">
                      Step {step + 1} of {STOCK_IN_STEPS.length} · {STOCK_IN_STEPS[step].title}
                      {draft.jobberName ? ` · ${draft.jobberName}` : ""} · started {formatDateOnly(String(draft.createdAt).slice(0, 10))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setDraftToDiscard(draft)} className="text-xs">Discard</Button>
                    <Button type="button" size="sm" onClick={() => navigate(`/stock-in/drafts/${draft.id}`)} className="gap-1 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700">
                      Continue draft <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Sheet>
      )}

      <Sheet>
        <div className="-mt-1 mb-4 flex gap-0.5 border-b border-slate-200">
          {TABS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn("-mb-px border-b-2 border-transparent px-4 py-2.5 text-[13.5px] font-semibold text-slate-500", tab === value && "border-emerald-600 text-slate-900")}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "register" ? (
          <ChallanRegister
            filters={filters}
            onFiltersChange={setFilters}
            onView={(challan) => setDrawerId(challan.id)}
            onPrint={handlePreview}
            onPdf={handleDownload}
          />
        ) : (
          <JobberSummary onOpenJobber={openJobber} />
        )}
      </Sheet>

      <ChallanDrawer
        challanId={drawerId}
        onClose={closeDrawer}
        onEdit={setEditing}
        onDrop={setDropping}
        onPreview={handlePreview}
        onDownload={handleDownload}
      />

      {previewing && (
        <ChallanPdfPreview challan={previewing} onClose={() => setPreviewing(null)} onActivity={(kind) => logEvent({ id: previewing.id, kind })} />
      )}
      {editing && <EditChallanDialog challan={editing} onClose={() => setEditing(null)} />}
      {dropping && <DropChallanDialog challan={dropping} nextSerial={nextSerial} onClose={() => setDropping(null)} />}

      <ActionModal
        openActionModal={Boolean(draftToDiscard)}
        setOpenActionModal={(open) => !open && setDraftToDiscard(null)}
        locked={isDeleting}
        title={draftToDiscard ? `Discard draft #${draftToDiscard.id}?` : "Discard draft?"}
        subtitle="It was never completed, so no stock or QR tags are affected. Everything entered in it will be permanently removed."
      >
        <div className="flex justify-end gap-3 px-6 py-4">
          <Button type="button" variant="outline" disabled={isDeleting} onClick={() => setDraftToDiscard(null)}>Keep draft</Button>
          <Button type="button" disabled={isDeleting} onClick={handleConfirmDiscard} className="gap-2 bg-red-600 text-white hover:bg-red-700">
            {isDeleting && <Loader2 className="size-4 animate-spin" />} Discard draft
          </Button>
        </div>
      </ActionModal>
    </div>
  );
};

export default StockInDashboard;
