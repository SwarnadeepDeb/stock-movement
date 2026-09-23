import { aggregateRows, computeVariantRow } from "../../../utils/qrTagStudio";

// Two independent switches, both on by default — what gets a printed label in this batch:
//   · Parent + Child — a tag on every sealed set / semi set, plus a hang tag on every piece.
//   · Loose pieces   — the odd pieces the jobber made outside a set.
// Turning one off never stops the codes being issued and the stock being registered; it only
// means those labels have to be printed later from QR Center.
const OPTIONS = [
  {
    key: "parentChild",
    name: "Parent + Child",
    description:
      "A bundle tag on every sealed set and semi set, plus a hang tag on every piece. Right when the piece needs a printed MRP tag anyway — the QR then rides along for free.",
  },
  {
    key: "loose",
    name: "Loose pieces",
    description:
      "Only the odd pieces the jobber made outside a set. Untick when the sets are already tagged, or when you are inwarding a sets-only challan.",
  },
];

const StrategyCards = ({ variants, perVariantSettings, tagParentChild, tagLoose, onToggleParentChild, onToggleLoose }) => {
  // "If this switch were on" totals, independent of the other switch.
  const rows = variants.map((variant) => computeVariantRow(variant, "parentChild", perVariantSettings));
  const aggregate = aggregateRows(rows);
  const counts = { parentChild: aggregate.parent + aggregate.child, loose: rows.reduce((sum, row) => sum + (row.included ? row.variant.looseTotal : 0), 0) };
  const checked = { parentChild: tagParentChild, loose: tagLoose };
  const toggles = { parentChild: onToggleParentChild, loose: onToggleLoose };

  const note =
    !tagParentChild && !tagLoose
      ? { tone: "amber", icon: "⚠", body: <><b>No tags will be generated.</b> Tick at least one tag type, or skip and print everything later from QR Center.</> }
      : !tagParentChild
        ? { tone: "amber", icon: "⚠", body: <><b>Set and semi-set bundles will leave this batch untagged.</b> Their codes are still issued and the stock is registered, but the labels have to be printed from QR Center before the goods reach a rack, or nobody can scan them.</> }
        : !tagLoose
          ? { tone: "amber", icon: "⚠", body: <><b>Loose pieces will leave this batch untagged.</b> Print their labels later from QR Center before they reach a rack.</> }
          : { tone: "green", icon: "✓", body: <><b>Codes are issued now, printed now.</b> Every piece in this challan gets a tag carrying the id it will keep for life — reprints later in QR Center reuse that same code, never a new one.</> };

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {OPTIONS.map((option) => {
          const on = checked[option.key];
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={on}
              onClick={toggles[option.key]}
              className={`block w-full rounded-xl border-[1.5px] bg-white p-4 text-left transition-colors ${
                on ? "border-emerald-500 bg-emerald-50/60" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className={`grid size-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] text-xs leading-none text-white ${
                    on ? "border-emerald-600 bg-emerald-600" : "border-slate-300"
                  }`}
                >
                  {on ? "✓" : ""}
                </span>
                <span className="text-[13.5px] font-semibold text-slate-900">{option.name}</span>
              </div>
              <p className="mb-3 text-[12.3px] leading-snug text-slate-500">{option.description}</p>
              <div className="border-t border-dashed border-slate-200 pt-2.5">
                <div className={`font-mono text-sm font-bold tabular-nums ${on ? "text-emerald-700" : "text-slate-900"}`}>{counts[option.key]}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{on ? "Tags" : "Tags · not generated"}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div
        className={`mt-3 flex gap-2 rounded-lg border p-3 text-[12.3px] leading-snug ${
          note.tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
        }`}
      >
        <span>{note.icon}</span>
        <div>{note.body}</div>
      </div>
    </div>
  );
};

export default StrategyCards;
