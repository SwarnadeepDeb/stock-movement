import { useState } from "react";

import ActionModal from "@/components/shared/ActionModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Lets the user define a Semi Set on the fly, for this Stock Inwarding transaction only —
// no Design Master record is created or touched. Tap the sizes bundled together and say how many
// such bundles arrived; one piece per tapped size. Composition/label are handed back through
// onSubmit exactly like a Design Master semi set would (see handleAddSemiSet in
// SetMatrixVariantCard), so downstream totals/payload building don't need to know the
// difference between the two origins.
const AddCustomSemiSetDialog = ({ sizes, onSubmit, onClose }) => {
  const [open, setOpen] = useState(true);
  const [picked, setPicked] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");

  const fullSetSizeIds = sizes.filter((size) => size.includedInSet).map((size) => size.id);
  const ordered = sizes.filter((size) => picked.includes(size.id));

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    if (!nextOpen) setTimeout(onClose, 150);
  };

  const toggle = (sizeId) => {
    setPicked((prev) => (prev.includes(sizeId) ? prev.filter((id) => id !== sizeId) : [...prev, sizeId]));
    setError("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (picked.length < 2) return setError("Pick at least 2 sizes — a single size is a loose piece.");
    if (fullSetSizeIds.length > 0 && fullSetSizeIds.every((id) => picked.includes(id)) && picked.length === fullSetSizeIds.length) {
      return setError(`That's the full ${ordered.map((size) => size.sizeLabel).join("-")} set — add it to Sets Received instead.`);
    }
    if (!(quantity >= 1)) return setError("Enter how many semi sets.");

    onSubmit({
      quantity,
      composition: Object.fromEntries(picked.map((id) => [id, 1])),
      label: ordered.map((size) => size.sizeLabel).join("-"),
    });
    handleOpenChange(false);
  };

  return (
    <ActionModal openActionModal={open} setOpenActionModal={handleOpenChange} title="Add Semi Set">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Sizes in this semi set</span>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size) => {
              const on = picked.includes(size.id);
              return (
                <button
                  key={size.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(size.id)}
                  className={cn(
                    "h-10 min-w-[52px] rounded-[9px] border-[1.5px] px-3 text-[13px] font-bold",
                    on ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
                  )}
                >
                  {size.sizeLabel}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500">
            {ordered.length
              ? <>Semi set: <b>{ordered.map((size) => size.sizeLabel).join(" · ")}</b> — {ordered.length} piece{ordered.length > 1 ? "s" : ""} each</>
              : "Tap the sizes that come bundled together."}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="semi-set-quantity" className="text-sm font-medium text-foreground">Number of semi sets</label>
          <Input
            id="semi-set-quantity"
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => setQuantity(Math.max(0, parseInt(event.target.value, 10) || 0))}
            className="max-w-[140px]"
          />
        </div>

        {error && <div className="text-xs text-red-600">{error}</div>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-700">Save semi set</Button>
        </div>
      </form>
    </ActionModal>
  );
};

export default AddCustomSemiSetDialog;
