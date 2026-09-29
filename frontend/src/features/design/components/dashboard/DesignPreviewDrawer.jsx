import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Check, Download, Loader2, Pencil, Share2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDesignDetailApi } from "../../hooks/useDesignDetailApi";

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

const Checkbox = ({ checked, onClick, label, className }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    aria-label={label}
    onClick={onClick}
    className={cn(
      "grid size-[19px] flex-none place-items-center rounded-[5px] border-[1.5px]",
      checked ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white",
      className,
    )}
  >
    {checked && <Check className="size-3" strokeWidth={3.5} />}
  </button>
);

const safeName = (value) => String(value ?? "").replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-|-$/g, "");

// Downloads the variant photos (Cloudinary allows cross-origin fetches) so they can be handed
// to the device's share sheet as real files, or saved.
async function loadPhotoFiles(design, variants) {
  return Promise.all(variants.map(async (variant) => {
    const response = await fetch(variant.imageUrl);
    if (!response.ok) throw new Error(`Couldn't load the ${variant.colorName} photo.`);
    const blob = await response.blob();
    const extension = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    return new File([blob], `${safeName(design.code || design.itemName)}-${safeName(variant.colorName)}.${extension}`, { type: blob.type });
  }));
}

const shareText = (design, variants) =>
  `Design ${design.code ?? ""} (${design.itemName || design.name}):\n${variants.map((variant) => `- ${variant.colorName}`).join("\n")}`;

// Right-hand drawer: the design's details, its variant photos (with stock on hand), and sharing
// the selected photos — through the device's share sheet where the browser supports files,
// otherwise as downloads plus a ready-made message.
const DesignPreviewDrawer = ({ designId, onClose, onEdit }) => {
  const { data, isLoading, isError, error } = useDesignDetailApi(designId);
  const design = data?.data;
  const variants = design?.colorVariants ?? [];
  // Photos the user has un-ticked (everything starts selected).
  const [deselected, setDeselected] = useState(() => new Set());
  const [isSharing, setIsSharing] = useState(false);
  const [fallback, setFallback] = useState(null);

  useEffect(() => {
    const handleKey = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Release object URLs made for the download fallback.
  useEffect(() => () => fallback?.links.forEach((link) => URL.revokeObjectURL(link.url)), [fallback]);

  const selected = variants.filter((variant) => !deselected.has(variant.id));
  const allSelected = variants.length > 0 && selected.length === variants.length;

  const toggle = (id) =>
    setDeselected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const share = async (chosen) => {
    if (!chosen.length) {
      toast.info("Select at least one photo first.");
      return;
    }
    setIsSharing(true);
    setFallback(null);
    const text = shareText(design, chosen);
    try {
      const files = await loadPhotoFiles(design, chosen);
      if (navigator.share && navigator.canShare?.({ files })) {
        try {
          await navigator.share({ files, title: design.itemName || design.name, text });
        } catch (shareError) {
          if (shareError?.name !== "AbortError") throw shareError;
        }
        return;
      }
      setFallback({ text, links: files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })) });
    } catch (shareError) {
      toast.error(shareError.message ?? "Couldn't prepare the photos.");
    } finally {
      setIsSharing(false);
    }
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(fallback.text);
      toast.success("Message copied.");
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access.");
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <aside role="dialog" aria-modal="true" aria-label="Design preview" className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[640px] flex-col bg-white shadow-[-10px_0_40px_rgba(15,23,42,0.14)]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-5">
          <div>
            <h3 className="font-mono text-sm font-bold text-slate-900">{design?.code ?? "—"}</h3>
            <div className="mt-0.5 text-[12.8px] text-slate-500">{design ? design.itemName || design.name : ""}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-[30px] place-items-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" /> Loading design…
            </div>
          ) : isError ? (
            <div className="py-16 text-center text-sm text-red-600">{error.message}</div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-x-5 gap-y-3 rounded-[11px] border border-slate-200 bg-slate-50 px-4 py-3.5">
                {[
                  ["Pattern", design.name],
                  ["Jobber", design.jobberName],
                  ["Quality", design.quality],
                  ["Price / piece", `₹${inr.format(design.defaultSellingPricePerPiece ?? 0)}`],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="text-[10.3px] font-bold uppercase tracking-[0.06em] text-slate-400">{label}</div>
                    <div className="mt-0.5 text-[13.3px] text-slate-900">{value || "—"}</div>
                  </div>
                ))}
                <div className="col-span-2">
                  <div className="text-[10.3px] font-bold uppercase tracking-[0.06em] text-slate-400">Set composition</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {design.sizes.map((size) => (
                      <span key={size.sizeLabel} className="rounded-[5px] border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                        {size.sizeLabel}
                      </span>
                    ))}
                  </div>
                </div>
                {design.semiSets.length > 0 && (
                  <div className="col-span-2">
                    <div className="text-[10.3px] font-bold uppercase tracking-[0.06em] text-slate-400">Semi sets</div>
                    <div className="mt-0.5 text-[13.3px] text-slate-900">
                      {design.semiSets.map((semiSet) => `${semiSet.label} (${semiSet.sizeLabels.join(" · ")})`).join(", ")}
                    </div>
                  </div>
                )}
                {design.notes && (
                  <div className="col-span-2">
                    <div className="text-[10.3px] font-bold uppercase tracking-[0.06em] text-slate-400">Notes</div>
                    <div className="mt-0.5 text-[13.3px] text-slate-900">{design.notes}</div>
                  </div>
                )}
              </div>

              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="text-[14.5px] font-bold text-slate-900">Design &amp; variant photos</h2>
                <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-700">
                  <Checkbox
                    checked={allSelected}
                    label="Select all photos"
                    onClick={() => setDeselected(allSelected ? new Set(variants.map((variant) => variant.id)) : new Set())}
                  />
                  Select all
                </label>
              </div>

              <div className="mb-3.5 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
                {variants.map((variant) => (
                  <div key={variant.id} className="overflow-hidden rounded-[13px] border border-slate-200 bg-white">
                    <div className="relative">
                      <img src={variant.imageUrl} alt={variant.colorName} loading="lazy" className="block aspect-square w-full object-cover" />
                      <Checkbox
                        checked={!deselected.has(variant.id)}
                        label={`Select ${variant.colorName}`}
                        onClick={() => toggle(variant.id)}
                        className="absolute left-2.5 top-2.5 shadow-[0_1px_4px_rgba(15,23,42,0.2)]"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate text-[12.8px] font-semibold text-slate-900">
                          <span className="size-2.5 flex-none rounded-full ring-1 ring-slate-200" style={{ backgroundColor: variant.colorHex }} />
                          {variant.colorName}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {variant.colorHex} · {variant.piecesInStock} pcs
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => share([variant])}
                        disabled={isSharing}
                        title="Share this photo"
                        aria-label={`Share the ${variant.colorName} photo`}
                        className="grid size-[30px] flex-none place-items-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Share2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <span className="text-[12.3px] text-slate-500">
                  {selected.length} of {variants.length} selected
                </span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => onEdit(design)} className="gap-1.5 rounded-full text-xs">
                    <Pencil className="size-3.5" /> Edit This Design
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => share(selected)}
                    disabled={isSharing}
                    className="gap-1.5 rounded-full bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                  >
                    {isSharing ? <Loader2 className="size-3.5 animate-spin" /> : <Share2 className="size-3.5" />}
                    Share Selected
                  </Button>
                </div>
              </div>

              {fallback && (
                <div className="mt-3.5">
                  <div className="rounded-[11px] border border-amber-200 bg-amber-50 px-4 py-3 text-[12.6px] leading-relaxed text-amber-800">
                    <b>This browser can&apos;t hand photos straight to another app</b> — that needs a device&apos;s share sheet, which desktop
                    browsers don&apos;t offer websites. Download the photos below and attach them yourself, or copy a ready-made message.
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {fallback.links.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        download={link.name}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Download className="size-3.5" /> {link.name}
                      </a>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2.5">
                    <Button type="button" variant="outline" size="sm" onClick={copyMessage} className="rounded-full text-xs">
                      Copy message
                    </Button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(fallback.text)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Open WhatsApp (text only)
                    </a>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
};

export default DesignPreviewDrawer;
