import { PrinterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { A4_PRESETS, PRINTERS, THERMAL_PRESETS } from "../../../utils/qrTagStudio";

const ENGINES = [
  { k: "thermal", n: "Thermal roll" },
  { k: "a4", n: "A4 sheet" },
];

const PrintEngineConfig = ({
  engine,
  onEngineChange,
  thermalPreset,
  onThermalPresetChange,
  a4Preset,
  onA4PresetChange,
  printer,
  onPrinterChange,
  onTestPrint,
  qrmm,
  onQrmmChange,
  typography,
  onTypographyChange,
  // [{ value, label }] — real printers when the caller has them; the wizard's fixed list otherwise.
  printerOptions,
}) => {
  const printers = printerOptions ?? PRINTERS.map((name) => ({ value: name, label: name }));
  return (
    <div className="overflow-hidden rounded-[10px] border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 className="text-[12.5px] font-bold tracking-tight text-slate-900">Print engine</h3>
        <div className="inline-flex gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-[2.5px]">
          {ENGINES.map((e) => (
            <button
              key={e.k}
              type="button"
              onClick={() => onEngineChange(e.k)}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${
                engine === e.k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {e.n}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <label className="mb-1.5 block text-[11.5px] font-semibold text-slate-600">Printing system</label>
          <select
            value={printer}
            onChange={(event) => onPrinterChange(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-[13px] text-slate-900"
          >
            {printers.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {engine === "thermal" ? (
          <div>
            <label className="mb-1.5 block text-[11.5px] font-semibold text-slate-600">Die-cut thermal preset</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {Object.entries(THERMAL_PRESETS).map(([key, p]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onThermalPresetChange(key)}
                  className={`w-full rounded-lg border-[1.5px] bg-white p-2.5 text-left ${
                    thermalPreset === key ? "border-emerald-500 bg-emerald-50/60" : "border-slate-200"
                  }`}
                >
                  <span className="block text-[9.5px] font-bold uppercase tracking-wide text-slate-400">{p.k}</span>
                  <span className="block font-mono text-[13px] font-bold text-slate-900">
                    {p.w} × {p.h} mm
                  </span>
                  <span className="block text-[11.5px] text-slate-500">{p.d}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <label className="mb-1.5 block text-[11.5px] font-semibold text-slate-600">Die-cut grid preset</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {Object.entries(A4_PRESETS).map(([key, p]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onA4PresetChange(key)}
                  className={`w-full rounded-lg border-[1.5px] bg-white p-2.5 text-left ${
                    a4Preset === key ? "border-emerald-500 bg-emerald-50/60" : "border-slate-200"
                  }`}
                >
                  <span className="block text-[9.5px] font-bold uppercase tracking-wide text-slate-400">{p.k} SHEET</span>
                  <span className="block font-mono text-[13px] font-bold text-slate-900">
                    {p.c} × {p.r} grid
                  </span>
                  <span className="block text-[11.5px] text-slate-500">
                    {p.w} × {p.h} mm
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={onTestPrint}
          className="w-full gap-1.5 rounded-lg border-slate-200 bg-slate-100 text-xs font-semibold text-slate-800 hover:bg-slate-200"
        >
          <PrinterIcon className="size-4 text-slate-600" />
          Test Single Tag Print
        </Button>

        <div>
          <label className="mb-1.5 flex items-baseline justify-between text-[11.5px] font-semibold text-slate-600">
            <span>QR matrix size</span>
            <span className="font-mono font-bold text-emerald-600">{qrmm} mm</span>
          </label>
          <input
            type="range"
            min={9}
            max={24}
            step={1}
            value={qrmm}
            onChange={(event) => onQrmmChange(Number(event.target.value))}
            className="w-full accent-emerald-600"
          />
          <div className="mt-0.5 flex justify-between font-mono text-[10.5px] text-slate-400">
            <span>9mm dense</span>
            <span>15mm floor</span>
            <span>24mm bold</span>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[11.5px] font-semibold text-slate-600">Typography scaling</label>
          <select
            value={typography}
            onChange={(event) => onTypographyChange(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-[13px] text-slate-900"
          >
            <option value="compact">Compact — fits more fields</option>
            <option value="standard">Standard — high legibility</option>
            <option value="large">Large — godown floor reading</option>
          </select>
        </div>

        {qrmm < 15 ? (
          <div
            className={`flex gap-2 rounded-lg p-3 text-[12.3px] leading-snug ${
              qrmm < 12 ? "border border-red-200 bg-red-50 text-red-600" : "border border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            <span>{qrmm < 12 ? "✕" : "⚠"}</span>
            <div>
              Under 15 mm starts failing to scan on wrinkled poly bags — nobody finds out until the goods are on a
              rack.
            </div>
          </div>
        ) : (
          engine === "thermal" && (
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12.3px] leading-snug text-amber-700">
              <span>⚠</span>
              <div>
                Load <b>thermal transfer with a wax-resin ribbon</b>, not direct thermal. Direct thermal fades to
                blank in a hot godown inside a season and you re-label the whole rack.
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default PrintEngineConfig;
