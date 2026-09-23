const QrPayloadPanel = ({ code }) => (
  <div className="overflow-hidden rounded-[10px] border border-slate-200 bg-white">
    <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
      <h3 className="text-[12.5px] font-bold tracking-tight text-slate-900">QR payload</h3>
      <span className="text-[11.5px] text-slate-500">Not configurable — by design</span>
    </div>
    <div className="p-4">
      <div className="rounded-[9px] border border-blue-200 bg-blue-50 p-3.5">
        <div className="font-mono text-[17px] font-bold tracking-wide text-blue-700">{code}</div>
        <p>The QR carries the id and nothing else</p>
        {/* <p className="mt-1.5 text-[12.3px] leading-snug text-blue-800">
          <b>The QR carries the id and nothing else.</b> Price, design name and MRP are printed on the tag but never
          encoded — so when a rate changes you update one database row instead of reprinting every label in the
          godown. A short payload also keeps the matrix small enough to scan off a creased poly bag.
        </p> */}
      </div>
    </div>
  </div>
);

export default QrPayloadPanel;
