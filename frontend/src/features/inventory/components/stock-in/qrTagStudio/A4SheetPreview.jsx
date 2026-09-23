import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import QrCodeImage from "../../qr-center/QrCodeImage";
import { A4_PRESETS, buildTagLines } from "../../../utils/qrTagStudio";

const LINE_PX = { title: { fontSize: "3.6px", fontWeight: 700 }, muted: { fontSize: "3.1px" }, bold: { fontSize: "3.4px", fontWeight: 700 }, price: { fontSize: "3.4px", fontWeight: 700 } };

// Real per-cell pagination — unlike a static sample grid, "used" cells for the start-at
// skip and every non-skipped cell's actual queued tag, matching what Download PDF /
// Send to printer will produce sheet-by-sheet.
const A4SheetPreview = ({ tags, a4Preset, startAt, buildTagData, fields, qrmm }) => {
  const grid = A4_PRESETS[a4Preset];
  const perSheet = grid.c * grid.r;
  const skip = Math.max(0, Number(startAt) - 1);
  const sheetCount = Math.max(1, Math.ceil((tags.length + skip) / perSheet));
  const [rawSheet, setSheet] = useState(0);
  // Clamped during render (never via an effect) — filters/pagination inputs changing can
  // shrink sheetCount below whatever page the user was previously on.
  const sheet = Math.min(rawSheet, sheetCount - 1);

  const cellQrPx = Math.max(9, Math.round(qrmm * 0.55));
  const cells = [];
  const pageStart = sheet * perSheet;
  const leadingSlots = Math.max(0, Math.min(perSheet, skip - pageStart));
  const firstTagIndex = Math.max(0, pageStart - skip);
  const tagCount = Math.min(perSheet - leadingSlots, Math.max(0, tags.length - firstTagIndex));

  for (let i = 0; i < leadingSlots; i++) {
    cells.push(<div key={`skip-${i}`} aria-hidden="true" />);
  }
  for (let i = 0; i < tagCount; i++) {
    const tag = tags[firstTagIndex + i];
    const data = buildTagData(tag);
    const bad = tag.flags?.some((flag) => flag.level === "bad");
    cells.push(
      <div key={`tag-${i}`} className={`flex min-w-0 items-center gap-[2.5px] overflow-hidden border-[0.5px] p-[2px] ${bad ? "border-red-400 bg-red-50" : "border-slate-300"}`}>
        <QrCodeImage value={tag.qrValue ?? tag.code} size={cellQrPx} />
        <div className="min-w-0 overflow-hidden font-mono leading-tight">
          {buildTagLines(tag, data, fields).map((line, n) => (
            <div key={n} className={`overflow-hidden text-ellipsis whitespace-nowrap ${line.style === "muted" ? "text-slate-600" : ""}`} style={LINE_PX[line.style]}>{line.text}</div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-3 pb-2 font-mono text-xs font-bold text-slate-700">
        <button type="button" onClick={() => setSheet((s) => Math.max(0, s - 1))} disabled={sheet === 0} className="grid size-7 place-items-center rounded-md border border-slate-400 disabled:opacity-35">
          <ChevronLeft className="size-4" />
        </button>
        <span>SHEET {sheet + 1} OF {sheetCount}</span>
        <button type="button" onClick={() => setSheet((s) => Math.min(sheetCount - 1, s + 1))} disabled={sheet >= sheetCount - 1} className="grid size-7 place-items-center rounded-md border border-slate-400 disabled:opacity-35">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="mx-auto flex aspect-[210/297] w-full max-w-[370px] flex-col overflow-hidden border border-slate-400 bg-white p-2">
        <div className="mb-1 flex justify-between border-b border-slate-300 pb-[3px] font-mono text-[5.4px] tracking-wide text-slate-500">
          <span>A4 DIE-CUT ({grid.c}×{grid.r} · {perSheet} LABELS)</span>
          <span>{sheet === 0 && skip > 0 ? `${skip} SKIPPED` : ""}</span>
        </div>
        <div className="grid min-h-0 flex-1 gap-[2.5px]" style={{ gridTemplateColumns: `repeat(${grid.c}, 1fr)`, gridTemplateRows: `repeat(${grid.r}, minmax(0, 1fr))` }}>
          {cells}
        </div>
      </div>
    </div>
  );
};

export default A4SheetPreview;
