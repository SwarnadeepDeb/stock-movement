import QrCodeImage from "../../qr-center/QrCodeImage";
import LabelTag from "./LabelTag";
import { A4_PRESETS, labelDims } from "../../../utils/qrTagStudio";

const LabelPreview = ({ engine, thermalPreset, a4Preset, a4StartAt, activeTab, data, fields, qrmm, typography, strategy, qrValue }) => {
  const dims = labelDims(engine, thermalPreset, a4Preset);

  if (engine === "thermal") {
    const showDual = strategy === "parentChild" && thermalPreset === "50x30" && activeTab === "parent";
    return (
      <div className="w-full max-w-[340px]">
        <div className="flex justify-between rounded-t-[5px] bg-slate-800 px-2.5 py-1.5 font-mono text-[9.5px] tracking-wide text-slate-400">
          <span>
            <span className="text-emerald-400">●</span> {data.printerShort} FEED MOUTH
          </span>
          <span>GAP SENSOR: ACTIVE</span>
        </div>
        <LabelTag kind={activeTab} data={data} fields={fields} qrmm={qrmm} typography={typography} qrValue={qrValue} />
        {showDual && (
          <>
            <div className="relative my-0 border-t border-dashed border-slate-400">
              <span className="absolute -top-[5px] left-0 size-[9px] bg-slate-900" />
            </div>
            <LabelTag kind="child" data={data} fields={fields} qrmm={qrmm} typography={typography} qrValue={data.childQrValue} />
          </>
        )}
      </div>
    );
  }

  const grid = A4_PRESETS[a4Preset];
  const start = Number(a4StartAt) || 0;
  const cellQrPx = Math.max(9, Math.round(qrmm * 0.55));
  const cells = [];
  for (let i = 0; i < grid.c * grid.r; i++) {
    const used = i < start;
    const seqId = activeTab === "parent" ? `${data.designCode}-${i + 1}` : `${data.designCode}-CH-${i + 1}`;
    cells.push(
      <div key={i} className={`flex min-w-0 items-center gap-[2.5px] overflow-hidden border-[0.5px] border-slate-300 p-[2px] ${used ? "border-dashed bg-slate-100" : ""}`}>
        {!used && (
          <>
            <QrCodeImage value={seqId} size={cellQrPx} />
            <div className="min-w-0 overflow-hidden font-mono leading-tight">
              <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[3.6px] font-bold">{seqId}</div>
              <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[3.1px] text-slate-600">
                {data.designCode} · {data.variantName}
              </div>
              <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[3.1px] text-slate-600">
                {activeTab === "parent" ? `SET ${data.piecesPerSet}-PC` : `SIZE ${data.size}`}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="aspect-[210/297] w-full max-w-[330px] overflow-hidden border border-slate-400 bg-white p-2">
      <div className="mb-1 border-b border-slate-300 pb-[3px] font-mono text-[5.6px] tracking-wide text-slate-500">
        A4 DIE-CUT STICKER SHEET (210 × 297 mm) — {grid.c} COLUMNS × {grid.r} ROWS · {grid.c * grid.r} LABELS · {start} USED
      </div>
      <div className="grid gap-[2.5px]" style={{ gridTemplateColumns: `repeat(${grid.c}, 1fr)` }}>
        {cells}
      </div>
      <p className="sr-only">{dims.w} × {dims.h} mm</p>
    </div>
  );
};

export default LabelPreview;
