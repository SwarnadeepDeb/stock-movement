import QrCodeImage from "../../qr-center/QrCodeImage";

const KIND_BRACKET = { parent: "PARENT SET", child: "GARMENT PIECE", loose: "LOOSE PIECE" };
const FONT_SCALE = { compact: 0.85, standard: 1, large: 1.18 };

export default function LabelTag({ kind, data, fields, qrmm, typography, qrValue }) {
  const fs = FONT_SCALE[typography];
  const f = fields[kind];

  return (
    <div className="relative border border-slate-500 bg-white p-[6px] font-mono text-black" style={{ fontSize: `${fs}em` }}>
      {f.firm && (
        <div className="mb-1 flex justify-between border-b border-slate-300 pb-0.5 text-[6.5px] tracking-wide text-slate-600">
          <span>{data.firm}</span>
          <span>[{KIND_BRACKET[kind]}]</span>
        </div>
      )}
      <div className="flex items-start gap-1.5">
        <QrCodeImage value={qrValue} size={Math.round(qrmm * 3)} className="shrink-0 rounded-sm border border-slate-200" />
        <div className="min-w-0 flex-1 leading-tight">
          {f.design && <div className="text-[11px] font-bold tracking-tight">{data.designCode}</div>}
          {f.dname && <div className="text-[7px] font-medium tracking-wide">{data.designName}</div>}
          {f.variant && <div className="text-[6.5px] tracking-wide text-slate-600">{data.variantName}</div>}

          {kind === "parent" && (
            <>
              {f.comp && <div className="mt-0.5 text-[8.5px] font-bold">{data.isSemiSet ? "SEMI" : "SET"}: {data.composition} ({data.piecesPerSet} Pcs)</div>}
              {f.jobber && <div className="text-[5.6px] tracking-wide text-slate-500">{data.jobber}</div>}
              {f.price && <div className="mt-0.5 text-[8px] font-bold">MRP {data.piecePrice} / PC</div>}
              {f.date && <div className="text-[5.6px] tracking-wide text-slate-500">INWARD {data.date}</div>}
            </>
          )}
          {(kind === "child" || kind === "loose") && (
            <>
              {f.size && <div className="mt-0.5 text-[8.5px] font-bold">SIZE {data.size}</div>}
              {kind === "child" && f.parent && (
                <div className="text-[5.6px] tracking-wide text-slate-500">PARENT: {data.parentSetId}</div>
              )}
              {f.jobber && <div className="text-[5.6px] tracking-wide text-slate-500">{data.jobber}</div>}
              {f.price && <div className="mt-0.5 text-[8px] font-bold">MRP {data.piecePrice} / PC</div>}
              {kind === "loose" && f.origin && (
                <div className="mt-0.5 inline-block border-[0.7px] border-black px-[3px] py-[0.5px] text-[5.8px] font-bold tracking-wide">
                  LOOSE — FROM JOBBER
                </div>
              )}
              {kind === "loose" && f.date && <div className="text-[5.6px] tracking-wide text-slate-500">LOOSE SINCE {data.date}</div>}
            </>
          )}
        </div>
      </div>
      <div className="mt-1 flex items-end justify-between gap-1.5 border-t border-slate-200 pt-0.5">
        <span className="text-[6px] tracking-wide text-slate-600">{data.pieceId}</span>
      </div>
    </div>
  );
}
