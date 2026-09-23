import { FIELD_DEFS } from "../../../utils/qrTagStudio";

const TABS = [
  { k: "parent", n: "Parent" },
  { k: "child", n: "Child" },
  { k: "loose", n: "Loose" },
];

const TagContentConfig = ({ activeTab, onTabChange, fields, onToggleField, capacity }) => {
  const list = FIELD_DEFS[activeTab];
  const onCount = list.filter((f) => fields[activeTab][f.k]).length;

  return (
    <div className="overflow-hidden rounded-[10px] border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 className="text-[12.5px] font-bold tracking-tight text-slate-900">Tag content</h3>
        <div className="inline-flex gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-[2.5px]">
          {TABS.map((tab) => (
            <button
              key={tab.k}
              type="button"
              onClick={() => onTabChange(tab.k)}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${
                activeTab === tab.k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {tab.n}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        <div>
          {list.map((field) => (
            <div key={field.k} className="flex items-center gap-2.5 border-b border-slate-100 py-2 last:border-0">
              <div className="relative flex size-4 shrink-0 items-center justify-center">
                <input
                  type="checkbox"
                  id={`f_${activeTab}_${field.k}`}
                  checked={Boolean(fields[activeTab][field.k])}
                  disabled={field.lock}
                  onChange={() => onToggleField(activeTab, field.k)}
                  className="peer size-4 shrink-0 appearance-none rounded-[3px] border-2 border-slate-900 bg-white checked:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                />
                <svg
                  className="pointer-events-none absolute hidden size-2.5 stroke-slate-900 peer-checked:block"
                  viewBox="0 0 12 10"
                  fill="none"
                >
                  <path d="M1.5 5.2 4.4 8 10.5 1.5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <label htmlFor={`f_${activeTab}_${field.k}`} className="min-w-0 flex-1 cursor-pointer text-[13px] text-slate-900">
                {field.n}
              </label>
              {field.lock && (
                <span className="whitespace-nowrap rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9.5px] font-bold tracking-wide text-slate-500">
                  REQUIRED
                </span>
              )}
            </div>
          ))}
        </div>

        {onCount > capacity ? (
          <div className="mt-3 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[12.3px] leading-snug text-red-600">
            <span>✕</span>
            <div>
              <b>{onCount} fields will not fit</b> on this label size. Drop {onCount - capacity}, shrink typography, or
              move to a taller die-cut.
            </div>
          </div>
        ) : activeTab === "child" && !fields.child.parent ? (
          <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12.3px] leading-snug text-amber-700">
            <span>⚠</span>
            <div>
              Without the <b>parent set ID</b> a loose piece on the floor gives no clue which set it came out of —
              keep it on.
            </div>
          </div>
        ) : activeTab === "loose" && !fields.loose.date ? (
          <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12.3px] leading-snug text-amber-700">
            <span>⚠</span>
            <div>
              The <b>loose-since date</b> is the ageing clock. Without it printed, nobody on the floor can tell a
              two-week-old orphan from a two-year-old one.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default TagContentConfig;
