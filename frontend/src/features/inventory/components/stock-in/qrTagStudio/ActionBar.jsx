import { Button } from "@/components/ui/button";

// What happens to the labels once the inward is registered. Nothing prints from this step: a
// tag's scannable short code only exists after Register, so printing earlier would put an id
// in the QR that no scan station can look up.
const PRINT_MODES = [
  { value: "printer", label: "Send to printer" },
  { value: "pdf", label: "Download PDF" },
  { value: "later", label: "Print later" },
];

const ActionBar = ({ totals, onSavePreset, isSavingPreset, printMode, onPrintModeChange }) => (
  <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
    <div className="flex flex-wrap gap-6">
      <div>
        <div className="font-mono text-base font-bold tabular-nums text-slate-900">{totals.tagsQueued}</div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tags queued</div>
      </div>
      <div>
        <div className="font-mono text-base font-bold tabular-nums text-slate-900">{totals.media}</div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Media</div>
      </div>
      {/* <div>
        <div className="font-mono text-base font-bold tabular-nums text-slate-900">{totals.applyTime}</div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Est. apply time</div>
      </div> */}
      <div>
        <div className={`font-mono text-base font-bold tabular-nums ${totals.issues ? "text-amber-600" : "text-slate-900"}`}>{totals.issues}</div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Need attention</div>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" onClick={onSavePreset} disabled={isSavingPreset} className="rounded-lg border-slate-200 text-xs font-semibold text-slate-700">
        {isSavingPreset ? "Saving…" : "Save as preset"}
      </Button>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-500">After registering:</span>
        <div role="radiogroup" aria-label="After registering" className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {PRINT_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              role="radio"
              aria-checked={printMode === mode.value}
              onClick={() => onPrintModeChange(mode.value)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                printMode === mode.value ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default ActionBar;
