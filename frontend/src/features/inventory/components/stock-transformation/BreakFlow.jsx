import { useState } from "react";
import { toast } from "react-toastify";
import { Loader2, Split } from "lucide-react";

import { Button } from "@/components/ui/button";
import { resolveUnitApi } from "../../services/stockTransformations.api";
import { useBreakUnitApi } from "../../hooks/useStockTransformationsApi";
import { BREAK_REASONS, CUSTODY, CUSTODY_ORDER, entryCode, needsHolder } from "../../utils/stockTransformation";
import { FIELD_INPUT } from "../current-stock/formControls";
import { ColorDot, Sheet } from "../current-stock/primitives";
import { CustodyPicker, Feedback, FlowShell, HolderInput, ScanInput } from "./ui";

// Break a set: scan its parent tag, choose where each piece goes, give a reason. The set leaves
// stock, its parent tag is retired, and every piece becomes a loose, individually tagged piece.
const BreakFlow = ({ holders, onClose, onDone }) => {
  const [unit, setUnit] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [isResolving, setIsResolving] = useState(false);
  const { mutateAsync: breakUnit, isPending } = useBreakUnitApi();

  const load = async (code) => {
    setIsResolving(true);
    try {
      const result = await resolveUnitApi(code);
      const data = result.data;
      setUnit(data);
      setDestinations(data.slots.map(() => ({ custodyType: "STOCK", holder: "" })));
      setFeedback({ kind: "ok", text: `${data.unit.code} · ${data.design.code} ${data.variant.colorName} · ${data.slots.length} pieces. Choose where each piece goes.` });
    } catch (error) {
      setFeedback({ kind: "bad", text: error.message });
    } finally {
      setIsResolving(false);
    }
  };

  const setDestination = (index, patch) =>
    setDestinations((current) => current.map((destination, i) => (i === index ? { ...destination, ...patch } : destination)));

  const counts = destinations.reduce((acc, destination) => ({ ...acc, [destination.custodyType]: (acc[destination.custodyType] ?? 0) + 1 }), {});

  const handleBreak = async () => {
    if (!unit) return;
    if (!reason) {
      toast.error("Choose why the set is being broken.");
      return;
    }
    const missing = destinations.findIndex((destination) => needsHolder(destination.custodyType) && !destination.holder.trim());
    if (missing >= 0) {
      toast.error(`Enter who has the ${unit.slots[missing].size} piece.`);
      return;
    }
    try {
      const result = await breakUnit({
        unitStockItemId: unit.unit.stockItemId,
        destinations: destinations.map((destination) => ({
          custodyType: destination.custodyType,
          holder: needsHolder(destination.custodyType) ? destination.holder.trim() : undefined,
        })),
        reason,
        note: note.trim() || undefined,
      });
      toast.success(`Broke ${unit.unit.code} · ${entryCode(result.data.entry.id)} · parent tag retired`);
      onDone();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <FlowShell
      eyebrow="Stock Transformation · dismantle"
      title="Break a set"
      onClose={onClose}
      footer={
        <>
          <span className="text-[12.8px] text-slate-500">
            {unit
              ? CUSTODY_ORDER.filter((type) => counts[type]).map((type) => `${counts[type]} ${CUSTODY[type].short.toLowerCase()}`).join(" · ")
              : "Scan a parent tag to begin."}
          </span>
          <div className="ml-auto flex gap-2.5">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={handleBreak} disabled={!unit || isPending} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Split className="size-4" />}
              Break set
            </Button>
          </div>
        </>
      }
    >
      <Sheet>
        <h2 className="text-base font-bold text-slate-900">Which set or semi set?</h2>
        <p className="mb-3 mt-0.5 text-[12.8px] text-slate-500">
          Scan its parent tag. Every piece gets (or keeps) its own tag and remembers which set it came from.
        </p>
        <ScanInput placeholder="Parent tag ID" onScan={load} disabled={isResolving || isPending} />
        <div className="mt-2">
          {isResolving ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" /> Looking up tag…
            </div>
          ) : (
            feedback && <Feedback kind={feedback.kind}>{feedback.text}</Feedback>
          )}
        </div>
      </Sheet>

      {unit && (
        <Sheet>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <ColorDot hex={unit.variant.colorHex} /> Where is each piece going?
              </h2>
              <p className="mt-0.5 text-[12.8px] text-slate-500">Pieces kept in stock become loose and can re-form a set later.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setDestinations(unit.slots.map(() => ({ custodyType: "STOCK", holder: "" })))}>
              All back to stock
            </Button>
          </div>

          <div className="overflow-hidden rounded-[13px] border border-slate-200">
            {unit.slots.map((slot, index) => (
              <div key={index} className="grid gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 md:grid-cols-[70px_1.5fr_3fr] md:items-center">
                <b className="font-mono text-[15px] text-slate-900">{slot.size}</b>
                <span className="font-mono text-[12.6px] font-semibold text-slate-700">{slot.code ?? "New tag on break"}</span>
                <div>
                  <CustodyPicker
                    value={destinations[index].custodyType}
                    options={CUSTODY_ORDER}
                    onChange={(custodyType) => setDestination(index, { custodyType, holder: "" })}
                  />
                  {needsHolder(destinations[index].custodyType) && (
                    <HolderInput
                      type={destinations[index].custodyType}
                      value={destinations[index].holder}
                      onChange={(holder) => setDestination(index, { holder })}
                      suggestions={holders[destinations[index].custodyType] ?? []}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3.5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12.3px] font-semibold text-slate-700">
                Why is it being broken? <span className="text-red-600">*</span>
              </label>
              <select className={FIELD_INPUT} value={reason} onChange={(event) => setReason(event.target.value)}>
                <option value="">Choose a reason</option>
                {BREAK_REASONS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12.3px] font-semibold text-slate-700">Note</label>
              <input className={FIELD_INPUT} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" maxLength={500} />
            </div>
          </div>

          <div className="mt-4">
            <Feedback kind="warn">
              The parent tag <b className="font-mono">{unit.unit.code}</b> will be <b>retired</b> — take it off the bundle. Piece tags keep
              scanning and remember which set they came from.
            </Feedback>
          </div>
        </Sheet>
      )}
    </FlowShell>
  );
};

export default BreakFlow;
