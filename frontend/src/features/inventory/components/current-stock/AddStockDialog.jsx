import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Loader2 } from "lucide-react";

import ActionModal from "@/components/shared/ActionModal";
import { Button } from "@/components/ui/button";
import { useAddStockApi } from "../../hooks/useCurrentStockOverviewApi";
import { ADD_REASONS, adjustmentCode, groupByDesign, toCount, variantLabel } from "../../utils/currentStock";
import { DialogFooter, Field, FIELD_INPUT, NumberInput, OptionButton, Preview } from "./formControls";

const KINDS = [
  { id: "SETS", label: "Complete sets" },
  { id: "SEMI", label: "Semi set" },
  { id: "LOOSE", label: "Loose pieces" },
];

// For stock that didn't come through Stock In — opening stock, a count correction or a customer
// return. Creates real stock items (with new QR tags for sets/semi sets) via the adjustments API.
const AddStockDialog = ({ variants, initialVariantId, onClose }) => {
  const designs = useMemo(() => groupByDesign(variants), [variants]);
  const initialVariant = variants.find((variant) => variant.colorVariantId === initialVariantId) ?? variants[0];

  const [colorVariantId, setColorVariantId] = useState(initialVariant?.colorVariantId ?? null);
  const [kind, setKind] = useState("SETS");
  const [sets, setSets] = useState("");
  const [semiSizeIds, setSemiSizeIds] = useState([]);
  const [semiCount, setSemiCount] = useState(1);
  const [loose, setLoose] = useState({});
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const { mutateAsync: addStock, isPending } = useAddStockApi();

  const variant = variants.find((item) => item.colorVariantId === colorVariantId);
  const designId = variant?.design.id;
  const designVariants = designs.find((group) => group.design.id === designId)?.variants ?? [];
  const setSizes = useMemo(() => variant?.sizes.filter((size) => size.includedInSet) ?? [], [variant]);

  const plan = useMemo(() => {
    if (!variant) return { ok: false, pieces: 0, text: "Pick a variant." };
    if (kind === "SETS") {
      const count = Number(sets) || 0;
      return { ok: count > 0 && setSizes.length > 0, pieces: count * setSizes.length, text: `${count} complete set${count === 1 ? "" : "s"} (${count * setSizes.length} pcs)` };
    }
    if (kind === "SEMI") {
      const count = Number(semiCount) || 0;
      const labels = variant.sizes.filter((size) => semiSizeIds.includes(size.designSizeId)).map((size) => size.size);
      if (labels.length < 2) return { ok: false, pieces: 0, text: "Pick at least 2 sizes." };
      if (labels.length >= setSizes.length) return { ok: false, pieces: 0, text: "All sizes picked — that’s a complete set." };
      return { ok: count > 0, pieces: labels.length * count, text: `${count} semi set${count === 1 ? "" : "s"} of ${labels.join("-")} (${labels.length * count} pcs)` };
    }
    const entries = variant.sizes.map((size) => ({ ...size, add: Number(loose[size.designSizeId]) || 0 })).filter((size) => size.add > 0);
    const total = entries.reduce((sum, size) => sum + size.add, 0);
    return {
      ok: total > 0,
      pieces: total,
      text: `${total} loose piece${total === 1 ? "" : "s"}${total ? ` (${entries.map((size) => `${size.size}:${size.add}`).join(" ")})` : ""}`,
    };
  }, [variant, kind, sets, semiCount, semiSizeIds, loose, setSizes]);

  const resetQuantities = () => {
    setSemiSizeIds([]);
    setLoose({});
  };

  const handleDesignChange = (event) => {
    const group = designs.find((item) => String(item.design.id) === event.target.value);
    setColorVariantId(group?.variants[0]?.colorVariantId ?? null);
    resetQuantities();
  };

  const handleVariantChange = (event) => {
    setColorVariantId(Number(event.target.value));
    resetQuantities();
  };

  const toggleSemiSize = (designSizeId) =>
    setSemiSizeIds((current) => (current.includes(designSizeId) ? current.filter((id) => id !== designSizeId) : [...current, designSizeId]));

  const handleSubmit = async () => {
    if (!plan.ok) {
      toast.error(kind === "SEMI" ? plan.text : "Enter a quantity.");
      return;
    }
    if (!reason) {
      toast.error("Choose a reason.");
      return;
    }
    const payload = { colorVariantId, kind, reason, note: note.trim() || undefined };
    if (kind === "SETS") payload.sets = Number(sets);
    if (kind === "SEMI") payload.semiSet = { designSizeIds: semiSizeIds, count: Number(semiCount) };
    if (kind === "LOOSE") {
      payload.loosePieces = variant.sizes
        .map((size) => ({ designSizeId: size.designSizeId, quantity: Number(loose[size.designSizeId]) || 0 }))
        .filter((piece) => piece.quantity > 0);
    }
    try {
      const result = await addStock(payload);
      toast.success(`Added ${plan.pieces} pcs to ${variantLabel(variant)} · ${adjustmentCode(result.data.id)}`);
      onClose();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <ActionModal
      openActionModal
      setOpenActionModal={(open) => !open && onClose()}
      locked={isPending}
      title="Add stock"
      className="max-w-xl sm:max-w-xl"
    >
      <div className="space-y-3.5 px-5 py-4 text-[13.3px] text-slate-700">
        <p className="m-0">
          For stock that didn’t come through Stock In — opening stock, a count correction or a customer return. New tag
          IDs are created for these pieces.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Design">
            <select className={FIELD_INPUT} value={designId ?? ""} onChange={handleDesignChange}>
              {designs.map(({ design }) => (
                <option key={design.id} value={design.id}>
                  {design.code} · {design.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Variant">
            <select className={FIELD_INPUT} value={colorVariantId ?? ""} onChange={handleVariantChange}>
              {designVariants.map((item) => (
                <option key={item.colorVariantId} value={item.colorVariantId}>
                  {item.colorName}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="What are you adding?">
          <div className="flex flex-wrap gap-2">
            {KINDS.map((option) => (
              <OptionButton key={option.id} active={kind === option.id} onClick={() => setKind(option.id)}>
                {option.label}
              </OptionButton>
            ))}
          </div>
        </Field>

        {kind === "SETS" && (
          <Field label="Number of complete sets" hint={`(${setSizes.length} pcs each: ${setSizes.map((size) => size.size).join(", ")})`}>
            <NumberInput className="w-36" min={1} placeholder="0" value={sets} onChange={(event) => setSets(toCount(event.target.value))} autoFocus />
          </Field>
        )}

        {kind === "SEMI" && (
          <>
            <Field label="Sizes in the semi set">
              <div className="flex flex-wrap gap-2">
                {setSizes.map((size) => (
                  <OptionButton key={size.designSizeId} active={semiSizeIds.includes(size.designSizeId)} onClick={() => toggleSemiSize(size.designSizeId)}>
                    {size.size}
                  </OptionButton>
                ))}
              </div>
            </Field>
            <Field label="How many semi sets like this?">
              <NumberInput className="w-36" min={1} value={semiCount} onChange={(event) => setSemiCount(toCount(event.target.value))} />
            </Field>
          </>
        )}

        {kind === "LOOSE" && (
          <Field label="Loose pieces by size">
            <div className="flex flex-wrap gap-2">
              {variant?.sizes.map((size) => (
                <label key={size.designSizeId} className="flex flex-col items-center gap-1 text-[11px] font-bold text-slate-400">
                  {size.size}
                  <NumberInput
                    className="w-16 px-2 text-center"
                    placeholder="0"
                    value={loose[size.designSizeId] ?? ""}
                    onChange={(event) => setLoose((current) => ({ ...current, [size.designSizeId]: toCount(event.target.value) }))}
                  />
                </label>
              ))}
            </div>
          </Field>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Reason" required>
            <select className={FIELD_INPUT} value={reason} onChange={(event) => setReason(event.target.value)}>
              <option value="">Choose a reason</option>
              {ADD_REASONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </Field>
          <Field label="Note">
            <input className={FIELD_INPUT} placeholder="Optional" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
          </Field>
        </div>

        <Preview>
          {plan.ok && variant ? (
            <>
              Adds <b>{plan.text}</b> to {variantLabel(variant)} · stock goes {variant.totalPieces} →{" "}
              <b>{variant.totalPieces + plan.pieces}</b> pcs
            </>
          ) : (
            <span className="text-slate-500">{plan.pieces === 0 && kind !== "SEMI" ? "Enter a quantity to see the change." : plan.text}</span>
          )}
        </Preview>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={isPending} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Add to stock
        </Button>
      </DialogFooter>
    </ActionModal>
  );
};

export default AddStockDialog;
