import { useEffect } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import QrCodeImage from "../qr-center/QrCodeImage";
import { buildTagList } from "../../utils/stockTransformation";

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

// Cosmetic bars under the tag ID — same decorative treatment as Stock In's LabelTag (only the QR
// carries data; the QR encodes the tag's short code, which every scan box accepts).
function barcodeBars(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: 34 }, () => {
    hash = (hash * 1103515245 + 12345) >>> 0;
    return hash % 2 === 0 ? 2 : 1;
  });
}

// One 50 × 30 mm thermal label (your standard QR Tag Studio size), drawn at `scale` px per mm.
// `tag`: { kind: "parent" | "child", code, unitKind, sizes, size, parentCode }, `info`: the
// design/colour/price shared by every tag of one formed set.
export const TagLabel = ({ tag, info, scale = 4 }) => {
  const mm = (value) => `${(value * scale).toFixed(2)}px`;
  const parent = tag.kind === "parent";
  const price = parent ? info.sellingPricePerPiece * tag.sizes.length : info.sellingPricePerPiece;

  return (
    <div
      className="theme-light relative flex-none overflow-hidden border border-slate-300 bg-white font-sans text-slate-900 shadow-[0_2px_6px_rgba(15,23,42,0.1)] print:border-0 print:shadow-none"
      style={{ width: mm(50), height: mm(30) }}
    >
      <div className="absolute font-bold leading-none tracking-[0.06em]" style={{ left: mm(1.6), top: mm(1.3), fontSize: mm(1.3) }}>
        STOCK MGMT
      </div>
      <div className="absolute font-bold leading-none text-slate-700" style={{ right: mm(1.6), top: mm(1.3), fontSize: mm(1.2) }}>
        {parent ? (tag.unitKind === "SEMI" ? "[SEMI SET]" : "[PARENT SET]") : "[GARMENT PIECE]"}
      </div>
      <div className="absolute border-t border-slate-900" style={{ left: mm(1.6), right: mm(1.6), top: mm(3.9) }} />
      <div className="absolute" style={{ left: mm(1.6), top: mm(5.2) }}>
        <QrCodeImage value={tag.code} size={17 * scale} />
      </div>
      <div className="absolute overflow-hidden whitespace-nowrap" style={{ left: mm(20.2), right: mm(1.4), top: mm(5.2) }}>
        <div className="font-bold leading-tight" style={{ fontSize: mm(2.7) }}>{info.design.code}</div>
        <div className="leading-snug" style={{ fontSize: mm(1.5) }}>{info.design.name}</div>
        <div className="leading-snug tracking-[0.04em]" style={{ fontSize: mm(1.35) }}>{info.colorName.toUpperCase()}</div>
        {parent ? (
          <div className="font-bold leading-snug" style={{ fontSize: mm(1.6), marginTop: mm(0.4) }}>
            {tag.unitKind === "SEMI" ? "SEMI" : "SET"}: {tag.sizes.join(" · ")} ({tag.sizes.length} Pcs)
          </div>
        ) : (
          <>
            <div className="font-bold leading-snug" style={{ fontSize: mm(1.75), marginTop: mm(0.4) }}>SIZE {tag.size}</div>
            <div className="text-slate-600" style={{ fontSize: mm(1.15) }}>PARENT: {tag.parentCode}</div>
          </>
        )}
        <div className="font-bold leading-snug" style={{ fontSize: mm(1.6) }}>
          MRP ₹ {inr.format(price)}
          {parent ? " (SET)" : ""}
        </div>
      </div>
      <div className="absolute font-mono font-bold" style={{ left: mm(1.6), bottom: mm(1.5), fontSize: mm(1.3) }}>
        {tag.code}
      </div>
      <div className="absolute flex items-stretch justify-end gap-[0.8px] overflow-hidden" style={{ right: mm(1.6), bottom: mm(1.2), width: mm(22), height: mm(3.4) }}>
        {barcodeBars(tag.code).map((width, index) => (
          <span key={index} className="block bg-black" style={{ width }} />
        ))}
      </div>
    </div>
  );
};

// Browser print of the tags at true label size (one 50 × 30 mm page per tag) — works with the
// thermal printer's own driver. Rendered into <body> so printing outputs only the labels.
export const PrintLabels = ({ labels, includeChildren, onClose }) => {
  useEffect(() => {
    document.body.classList.add("tf-printing");
    const handleKey = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.classList.remove("tf-printing");
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const tags = buildTagList(labels, { includeChildren });

  return createPortal(
    <div className="tf-print-root fixed inset-0 z-[95] flex flex-col items-center overflow-y-auto bg-slate-900/60 px-4 pb-10 pt-6" role="dialog" aria-label="Print tags">
      <div className="tf-print-bar mb-4 flex w-full max-w-[640px] flex-wrap items-center justify-between gap-3 text-white">
        <span className="text-sm font-semibold">
          {tags.length} tag{tags.length === 1 ? "" : "s"} · 50 × 30 mm · choose your label printer in the print dialog
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="bg-white text-slate-800">
            Done
          </Button>
          <Button type="button" size="sm" onClick={() => window.print()} className="bg-emerald-600 text-white hover:bg-emerald-700">
            Print tags
          </Button>
        </div>
      </div>
      <div className="flex flex-col items-center gap-3">
        {tags.map((tag) => (
          <div key={`${tag.kind}-${tag.code}`} className="tf-label-page">
            <TagLabel tag={tag} info={labels} scale={3.78} />
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
};
