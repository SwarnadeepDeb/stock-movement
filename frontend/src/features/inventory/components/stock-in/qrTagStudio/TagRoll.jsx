import LabelTag from "./LabelTag";

const FLAG_STYLES = {
  bad: "border-red-200 bg-red-50 text-red-600",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
};

// Every queued tag, in print order — the mockup's ".roll"/".tagslot"/".perf" thermal-feed
// view. Unlike a single sample preview, this is what actually gets scrolled and checked
// before printing (see the "Preview is size-accurate" note in QrTagStudioStep).
const TagRoll = ({ tags, buildTagData, fields, qrmm, typography, zoom, printerShort }) => (
  <div className="w-full">
    <div className="sticky top-0 z-10 flex justify-between rounded-t-[5px] bg-slate-800 px-3 py-1.5 font-mono text-[9.5px] tracking-wide text-slate-400">
      <span><span className="text-emerald-400">●</span> {printerShort} FEED MOUTH</span>
      <span>{tags.length} LABELS · GAP SENSOR ACTIVE</span>
    </div>
    <div className="flex flex-col items-center gap-0 bg-slate-200 py-4">
      {tags.length === 0 ? (
        <div className="px-5 py-14 text-center text-[13px] text-slate-500">No tags match this filter.</div>
      ) : (
        tags.map((tag, index) => (
          <div key={tag.id} className="flex w-full max-w-[400px] gap-2.5 px-3.5" style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}>
            <span className="w-6 shrink-0 pt-1.5 text-right font-mono text-[10px] font-bold text-slate-500">
              {String(index + 1).padStart(3, "0")}
            </span>
            <div className="min-w-0 flex-1 pb-3.5">
              <LabelTag kind={tag.kind} data={buildTagData(tag)} fields={fields} qrmm={qrmm} typography={typography} qrValue={tag.qrValue ?? tag.code} />
              {tag.flags?.map((flag, flagIndex) => (
                <span key={flagIndex} className={`mt-1 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10.5px] font-bold ${FLAG_STYLES[flag.level]}`}>
                  {flag.level === "bad" ? "✕" : "⚠"} {flag.text}
                </span>
              ))}
              {index < tags.length - 1 && <div className="mt-3.5 w-full max-w-[400px] border-t border-dashed border-slate-400" />}
            </div>
          </div>
        ))
      )}
      {tags.length > 0 && <div className="pt-3 font-mono text-[10px] text-slate-500">— END OF JOB —</div>}
    </div>
  </div>
);

export default TagRoll;
