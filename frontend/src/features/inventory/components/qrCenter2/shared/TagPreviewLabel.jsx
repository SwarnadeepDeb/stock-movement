import QrCodeImage from "../../qr-center/QrCodeImage.jsx";

// Real-data counterpart of the reference mockup's `label()` string-builder — same visual
// layout, but every value is a prop sourced from the backend instead of a demo lookup table.
// `theme-light` keeps it paper-white in dark mode, since it depicts the printed label.
export default function TagPreviewLabel({ shortCode, kind, designCode, designName, colorName, sizeLabel, semiLabel, parentShortCode, mrp, inwardDate }) {
    const isSet = kind === "SET";
    const isSemi = kind === "SEMI" || kind === "BUNDLE";
    const isLoose = kind === "LOOSE" || kind === "LOOSE_PIECE";

    return (
        <div className="theme-light w-[268px] max-w-full self-start border border-slate-500 bg-white px-2 py-1.5 font-mono text-black">
            <div className="mb-1.5 flex justify-between border-b-[.5px] border-slate-300 pb-[3px] text-[6.5px] tracking-[.06em] text-slate-700">
                <span>STOCK MGMT</span>
                <span>[{isSet ? "PARENT SET" : isSemi ? "SEMI SET" : isLoose ? "LOOSE PIECE" : "GARMENT PIECE"}]</span>
            </div>
            <div className="flex items-start gap-2">
                <div><QrCodeImage value={shortCode} size={58} /></div>
                <div className="min-w-0 flex-1 leading-[1.35]">
                    <div className="text-xs font-bold">{designCode}</div>
                    <div className="text-[7.5px]">{designName}</div>
                    <div className="text-[6.5px] tracking-[.05em] text-slate-700">{colorName?.toUpperCase()}</div>
                    {isSet && <div className="mt-0.5 text-[9px] font-bold">SET{mrp != null ? ` · MRP ₹ ${mrp}` : ""}</div>}
                    {isSemi && <div className="mt-0.5 text-[9px] font-bold">SEMI: {semiLabel ?? "—"}</div>}
                    {!isSet && !isSemi && (
                        <>
                            <div className="mt-0.5 text-[9px] font-bold">SIZE {sizeLabel ?? "—"}</div>
                            {parentShortCode && <div className="text-[6px] tracking-[.04em] text-slate-500">PARENT: {parentShortCode}</div>}
                            {isLoose && <div className="text-[6px] tracking-[.04em] text-slate-500">LOOSE — FROM JOBBER</div>}
                        </>
                    )}
                    {inwardDate && <div className="text-[6px] tracking-[.04em] text-slate-500">INWARD {inwardDate}</div>}
                </div>
            </div>
            <div className="mt-1.5 flex items-end justify-between gap-1.5 border-t-[.5px] border-slate-200 pt-[3px]">
                <span className="text-[6px] tracking-[.05em] text-slate-700">{shortCode}</span>
            </div>
        </div>
    );
}
