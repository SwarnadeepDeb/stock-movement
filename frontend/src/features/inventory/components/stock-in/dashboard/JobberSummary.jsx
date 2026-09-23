import { ArrowRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useStockInJobberSummaryApi } from "../../../hooks/useStockInChallansApi";

// Active challans rolled up by jobber — total deliveries and pieces received.
const JobberSummary = ({ onOpenJobber }) => {
  const { data, isLoading, isError, error } = useStockInJobberSummaryApi();
  const rows = data?.data ?? [];

  if (isLoading) return <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> Loading…</div>;
  if (isError) return <div className="py-10 text-center text-sm text-red-600">{error.message}</div>;
  if (rows.length === 0) return <div className="py-10 text-center text-sm text-slate-500"><b className="block text-[15px] text-slate-900">No challans yet</b></div>;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="hidden grid-cols-[2fr_1fr_1.2fr_140px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[9.8px] font-bold uppercase tracking-wider text-slate-400 sm:grid">
        <span>Jobber</span><span>Challans</span><span>Pieces received</span><span />
      </div>
      {rows.map((row) => (
        <div key={row.jobberName} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-slate-100 px-4 py-3 text-[13px] last:border-b-0 sm:grid-cols-[2fr_1fr_1.2fr_140px]">
          <b className="text-slate-900">{row.jobberName}</b>
          <span className="font-mono text-slate-600">{row.challanCount} <span className="text-xs text-slate-400 sm:hidden">challans</span></span>
          <span className="font-mono font-bold text-slate-900">{row.pieces?.toLocaleString("en-IN")} <span className="text-xs font-normal text-slate-400 sm:hidden">pcs</span></span>
          <div className="text-right">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenJobber(row.jobberName)} className="gap-1.5 text-xs">
              Challans <ArrowRight className="size-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default JobberSummary;
