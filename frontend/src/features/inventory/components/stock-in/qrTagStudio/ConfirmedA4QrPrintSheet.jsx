import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import QrCodeImage from "../../qr-center/QrCodeImage";
import { buildConfirmedLabelLines } from "../../../utils/confirmedLabelLines";

const LINE_STYLE = {
  title: { fontSize: "2mm", fontWeight: 700 },
  bold: { fontSize: "1.7mm", fontWeight: 700 },
  price: { fontSize: "1.9mm", fontWeight: 700 },
  muted: { fontSize: "1.7mm" },
};

const LABELS_PER_SHEET = 40;

const ConfirmedA4QrPrintSheet = ({ items, startAt, content = {}, onAfterPrint }) => {
  const onAfterPrintRef = useRef(onAfterPrint);

  useEffect(() => {
    onAfterPrintRef.current = onAfterPrint;
  }, [onAfterPrint]);

  useEffect(() => {
    const handleAfterPrint = () => onAfterPrintRef.current();
    window.addEventListener("afterprint", handleAfterPrint, { once: true });
    const frame = window.requestAnimationFrame(() => window.print());

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  const skippedSlots = Math.max(0, Number(startAt) - 1);
  const sheetCount = Math.max(1, Math.ceil((items.length + skippedSlots) / LABELS_PER_SHEET));
  const pages = [];

  for (let pageIndex = 0; pageIndex < sheetCount; pageIndex += 1) {
    const pageStart = pageIndex * LABELS_PER_SHEET;
    const blankCount = Math.max(0, Math.min(LABELS_PER_SHEET, skippedSlots - pageStart));
    const firstItemIndex = Math.max(0, pageStart - skippedSlots);
    const itemCount = Math.min(LABELS_PER_SHEET - blankCount, items.length - firstItemIndex);
    const cells = [];

    for (let index = 0; index < blankCount; index += 1) {
      cells.push(<div key={`blank-${pageIndex}-${index}`} aria-hidden="true" />);
    }

    for (let index = 0; index < itemCount; index += 1) {
      const item = items[firstItemIndex + index];
      const payload = item.payload ?? {};
      const isParent = item.type === "SET" || item.type === "BUNDLE";
      const designCode = item.design?.code ?? payload.designCode ?? "STOCK";
      const variantName = (item.variant?.colorName ?? payload.colorName ?? "").toUpperCase();
      const stockId = item.displayCode ?? payload.setId ?? item.stockItemId;
      const price = Number(item.priceSnapshot ?? item.sellingPricePerPiece ?? 0);
      const setPrice = price * Number(item.piecesPerSet ?? item.composition?.length ?? 0);
      const qrmm = Math.min(24, Math.max(9, Number(content.qrmm) || 17));
      const detail = isParent
        ? `${item.type === "BUNDLE" ? "SEMI" : "SET"} ${item.piecesPerSet ?? item.composition?.length ?? 0}-PC`
        : `SIZE ${item.designSizeLabel ?? ""}`;
      const priceText = isParent ? `₹ ${setPrice.toLocaleString("en-IN")} (SET)` : `₹ ${price.toLocaleString("en-IN")}`;
      const lines = buildConfirmedLabelLines(item, content);
      cells.push(
        <div
          key={`qr-${item.stockItemId}`}
          className="flex items-center gap-[1mm] overflow-hidden border border-slate-300 p-[1mm] font-mono text-black"
          style={{ width: "52.5mm", height: "29.7mm", boxSizing: "border-box",padding:"3mm" }}
        >
          {/* The QR carries the tag's saved shortCode — the code every scan station resolves. */}
          <QrCodeImage
            value={item.shortCode ?? JSON.stringify(payload)}
            size={200}
            style={{ width: `${qrmm}mm`, height: `${qrmm}mm` }}
            className="shrink-0"
          />
          <div className="min-w-0 flex-1 overflow-hidden font-mono leading-tight">
            {lines ? (
              lines.map((line, lineIndex) => (
                <div
                  key={lineIndex}
                  className={`overflow-hidden text-ellipsis whitespace-nowrap ${line.style === "muted" ? "text-slate-600" : ""}`}
                  style={LINE_STYLE[line.style]}
                >
                  {line.text}
                </div>
              ))
            ) : (
              <>
                <div className="overflow-hidden text-ellipsis whitespace-nowrap font-bold" style={{ fontSize: "2mm" }}>{stockId}</div>
                <div className="overflow-hidden text-ellipsis whitespace-nowrap text-slate-600" style={{ fontSize: "1.7mm" }}>{designCode} · {variantName}</div>
                <div className="overflow-hidden text-ellipsis whitespace-nowrap text-slate-600" style={{ fontSize: "1.7mm" }}>{detail}</div>
                <div className="font-bold" style={{ fontSize: "1.9mm" }}>{priceText}</div>
              </>
            )}
          </div>
        </div>,
      );
    }

    pages.push(
      <div
        key={`page-${pageIndex}`}
        className="confirmed-a4-print-page"
        style={{
          width: "210mm",
          height: "297mm",
          display: "grid",
          placeItems: "center",
          breakAfter: pageIndex < sheetCount - 1 ? "page" : "auto",
          pageBreakAfter: pageIndex < sheetCount - 1 ? "always" : "auto",
        }}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: "repeat(4, 52.5mm)",
            gridTemplateRows: "repeat(10, 29.7mm)",
            width: "210mm",
            height: "297mm",
          }}
        >
          {cells}
        </div>
      </div>,
    );
  }

  return createPortal(
    <div id="confirmed-a4-qr-print">
      <style>{`
        #confirmed-a4-qr-print { display: none; }
        @media print {
          @page { size: A4; margin: 0; }
          html, body { width: 210mm !important; margin: 0 !important; padding: 0 !important; }
          body > *:not(#confirmed-a4-qr-print) { display: none !important; }
          #confirmed-a4-qr-print { display: block !important; position: static; width: 210mm; }
          #confirmed-a4-qr-print > style { display: none !important; }
          .confirmed-a4-print-page { break-inside: avoid; }
        }
      `}</style>
      {pages}
    </div>,
    document.body,
  );
};

export default ConfirmedA4QrPrintSheet;
