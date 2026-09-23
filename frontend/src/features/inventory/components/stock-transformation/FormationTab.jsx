import { Merge, MoveRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CUSTODY, agoText, isFormable } from "../../utils/stockTransformation";
import { ColorDot } from "../current-stock/primitives";
import { Feedback, SizeSlot } from "./ui";

const TAGS = {
  RESTORE: { label: "RESTORE ORIGINAL", className: "bg-emerald-600 text-white" },
  FORM: { label: "FORM COMPLETE SET", className: "border border-emerald-200 bg-emerald-50 text-emerald-700" },
  RECALL: { label: "RECALL TO COMPLETE", className: "border border-violet-200 bg-violet-50 text-violet-700" },
  SEMI: { label: "SEMI SET", className: "border border-slate-200 bg-slate-100 text-slate-500" },
};

function headline(suggestion) {
  if (suggestion.kind === "RESTORE") {
    return (
      <>
        All {suggestion.slots.length} pieces of <span className="font-mono">{suggestion.unit.code}</span> are back in stock
      </>
    );
  }
  if (suggestion.kind === "FORM") return `Loose pieces cover every size (${suggestion.slots.map((slot) => slot.size).join(" · ")})`;
  if (suggestion.kind === "RECALL") {
    const out = suggestion.slots.filter((slot) => slot.recall);
    return (
      <>
        {out.length} piece{out.length === 1 ? "" : "s"} away from a complete set —{" "}
        {out.map((slot, index) => (
          <span key={slot.piece.stockItemId}>
            {index > 0 && ", "}
            <b>{slot.size}</b> is {CUSTODY[slot.piece.custody.type].label.toLowerCase()}
            {slot.piece.custody.holder ? ` (${slot.piece.custody.holder})` : ""} for {agoText(slot.piece.custody.days)}
          </span>
        ))}
      </>
    );
  }
  return `No ${suggestion.missingSizes.join(", ")} anywhere — bundle ${suggestion.slots.map((slot) => slot.size).join(" · ")} as a semi set instead?`;
}

// "Set formation": what can be (re)built from loose pieces right now, best first — restore an
// original, then new complete sets, then pieces worth recalling, then a semi set as last resort.
const FormationTab = ({ suggestions, onForm, onRecall }) => {
  const bestIndex = suggestions.findIndex(isFormable);
  return (
    <div>
      <p className="mb-3.5 text-[12.8px] text-slate-500">
        Best first: restore an original set, then form new complete sets (same challan preferred, oldest pieces first), then pieces
        worth recalling. A semi set is the last resort.
      </p>
      {suggestions.length === 0 ? (
        <div className="rounded-[13px] border border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
          <b className="mb-1 block text-[15px] text-slate-900">No sets can be formed right now</b>
          Suggestions appear the moment loose pieces cover every size — for example when a sample comes back.
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.kind}-${index}`}
              className={cn(
                "overflow-hidden rounded-[15px] border-[1.5px] bg-white",
                index === bestIndex ? "border-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.1)]" : "border-slate-200",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 md:px-5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-bold tracking-[0.06em]", TAGS[suggestion.kind].className)}>
                    {TAGS[suggestion.kind].label}
                  </span>
                  <ColorDot hex={suggestion.variant.colorHex} />
                  <b className="text-slate-900">
                    {suggestion.design.code} {suggestion.variant.colorName}
                  </b>
                  <span className="text-[13px] text-slate-600">{headline(suggestion)}</span>
                </div>
                {suggestion.kind === "RECALL" ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => onRecall(suggestion)} className="gap-1.5 text-xs">
                    <MoveRight className="size-3.5" /> Record return
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onForm(suggestion)}
                    className={cn(
                      "gap-1.5 text-xs",
                      suggestion.kind === "SEMI" ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50" : "bg-emerald-600 text-white hover:bg-emerald-700",
                    )}
                  >
                    <Merge className="size-3.5" />
                    {suggestion.kind === "RESTORE" ? "Restore as a set" : suggestion.kind === "SEMI" ? "Make semi set" : "Form set"}
                  </Button>
                )}
              </div>
              <div className="px-4 pb-4 md:px-5">
                <div className="flex flex-wrap gap-2">
                  {suggestion.slots.map((slot, slotIndex) => (
                    <SizeSlot key={`${slot.designSizeId}-${slotIndex}`} size={slot.size} piece={slot.piece} tone={slot.recall ? "out" : "ok"} />
                  ))}
                  {suggestion.kind === "SEMI" &&
                    suggestion.missingSizes.map((size) => <SizeSlot key={`missing-${size}`} size={size} piece={null} emptyText="not available" />)}
                </div>
                {suggestion.kind === "FORM" && suggestion.challans.length > 1 && (
                  <div className="mt-2.5">
                    <Feedback kind="warn">
                      Pieces come from <b>{suggestion.challans.length} different challans</b> ({suggestion.challans.join(", ")}). Check the shade
                      matches before bundling.
                    </Feedback>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FormationTab;
