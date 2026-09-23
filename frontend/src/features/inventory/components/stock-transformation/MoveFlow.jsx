import { useState } from "react";
import { toast } from "react-toastify";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { resolvePieceApi } from "../../services/stockTransformations.api";
import { useMovePiecesApi } from "../../hooks/useStockTransformationsApi";
import { CUSTODY, CUSTODY_ORDER, entryCode, needsHolder, pieceLabel } from "../../utils/stockTransformation";
import { FIELD_INPUT } from "../current-stock/formControls";
import { Sheet } from "../current-stock/primitives";
import { CustodyPicker, Feedback, FlowShell, HolderInput, ScanInput, WhereChip } from "./ui";

// Move or return tagged loose pieces: scan each piece, choose where they go. Opened pre-filled
// from "Record return" / "Move" buttons elsewhere on the page.
const MoveFlow = ({ presetPieces = [], presetDestination = null, presetReason = "", holders, onClose, onDone }) => {
  const [pieces, setPieces] = useState(presetPieces);
  const [destination, setDestination] = useState(presetDestination);
  const [holder, setHolder] = useState("");
  const [reason, setReason] = useState(presetReason);
  const [feedback, setFeedback] = useState(null);
  const [isResolving, setIsResolving] = useState(false);
  const { mutateAsync: movePieces, isPending } = useMovePiecesApi();

  const addPiece = async (code) => {
    setIsResolving(true);
    try {
      const { data: piece } = await resolvePieceApi(code);
      if (pieces.some((item) => item.stockItemId === piece.stockItemId)) {
        setFeedback({ kind: "warn", text: `${pieceLabel(piece)} is already on the list.` });
        return;
      }
      setPieces((current) => [...current, piece]);
      const where = piece.custody.type === "STOCK" ? "in stock" : CUSTODY[piece.custody.type].short.toLowerCase();
      setFeedback({ kind: "ok", text: `Added ${pieceLabel(piece)} (${piece.design.code} ${piece.variant.colorName}, size ${piece.size}) · now ${where}${piece.custody.holder ? ` (${piece.custody.holder})` : ""}.` });
    } catch (error) {
      setFeedback({ kind: "bad", text: error.message });
    } finally {
      setIsResolving(false);
    }
  };

  const cleanHolder = needsHolder(destination) ? holder.trim() : null;
  const alreadyThere = destination
    ? pieces.filter((piece) => piece.custody.type === destination && (piece.custody.holder ?? null) === cleanHolder)
    : [];

  const handleConfirm = async () => {
    if (needsHolder(destination) && !holder.trim()) {
      toast.error(`Enter the ${CUSTODY[destination].holderLabel.toLowerCase()}.`);
      return;
    }
    try {
      const result = await movePieces({
        stockItemIds: pieces.map((piece) => piece.stockItemId),
        custodyType: destination,
        holder: cleanHolder ?? undefined,
        reason: reason.trim() || undefined,
      });
      const { moved, entries } = result.data;
      toast.success(`${destination === "STOCK" ? "Returned" : "Moved"} ${moved} pc${moved === 1 ? "" : "s"} · ${entries.map((entry) => entryCode(entry.id)).join(", ")}`);
      onDone();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const title = presetDestination === "STOCK" ? "Return pieces to stock" : "Move or return pieces";

  return (
    <FlowShell
      eyebrow="Stock Transformation · whereabouts"
      title={title}
      onClose={onClose}
      footer={
        <>
          <span className="text-[12.8px] text-slate-500">
            {!pieces.length
              ? "Scan at least one piece."
              : !destination
                ? `${pieces.length} piece${pieces.length === 1 ? "" : "s"} · choose where to`
                : `${pieces.length} piece${pieces.length === 1 ? "" : "s"} → ${CUSTODY[destination].short}${alreadyThere.length ? ` · ${alreadyThere.length} already there` : ""}`}
          </span>
          <div className="ml-auto flex gap-2.5">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!pieces.length || !destination || isPending || alreadyThere.length === pieces.length}
              className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {destination === "STOCK" ? `Return ${pieces.length || ""} to stock` : "Confirm move"}
            </Button>
          </div>
        </>
      }
    >
      <Sheet>
        <h2 className="text-base font-bold text-slate-900">Which pieces?</h2>
        <p className="mb-3 mt-0.5 text-[12.8px] text-slate-500">
          Scan each piece tag. Pieces inside an intact set have to be broken out of it first; untagged loose pieces can&apos;t be tracked out of stock.
        </p>
        <ScanInput placeholder="Piece tag ID" onScan={addPiece} disabled={isResolving || isPending} autoFocus={!presetPieces.length} />
        <div className="mt-2">
          {isResolving ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" /> Looking up tag…
            </div>
          ) : (
            feedback && <Feedback kind={feedback.kind}>{feedback.text}</Feedback>
          )}
        </div>
        <div className="mt-3 flex min-h-[34px] flex-wrap gap-1.5">
          {pieces.length === 0 ? (
            <span className="text-[12.8px] text-slate-500">No pieces yet.</span>
          ) : (
            pieces.map((piece) => (
              <span key={piece.stockItemId} className="inline-flex items-center gap-2 rounded-[9px] border border-slate-300 bg-white py-1.5 pl-3 pr-2 font-mono text-[11.8px] font-semibold text-slate-800">
                {pieceLabel(piece)} <span className="font-sans font-normal text-slate-400">{piece.size}</span>
                <WhereChip piece={piece} />
                <button
                  type="button"
                  aria-label={`Remove ${pieceLabel(piece)}`}
                  onClick={() => setPieces((current) => current.filter((item) => item.stockItemId !== piece.stockItemId))}
                  className="grid place-items-center text-slate-400 hover:text-red-600"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))
          )}
        </div>
      </Sheet>

      <Sheet>
        <h2 className="mb-2.5 text-base font-bold text-slate-900">Where to?</h2>
        <CustodyPicker
          value={destination}
          options={CUSTODY_ORDER}
          onChange={(type) => {
            setDestination(type);
            setHolder("");
          }}
        />
        {needsHolder(destination) && <HolderInput type={destination} value={holder} onChange={setHolder} suggestions={holders[destination] ?? []} />}
        <div className="mt-3.5 max-w-[520px]">
          <label className="mb-1.5 block text-[12.3px] font-semibold text-slate-700">Reason / note</label>
          <input className={FIELD_INPUT} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Ravi back from the Ahmedabad route" maxLength={150} />
        </div>
      </Sheet>
    </FlowShell>
  );
};

export default MoveFlow;
