import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import StrategyCards from "../../components/stock-in/qrTagStudio/StrategyCards";
import GenerationQueue from "../../components/stock-in/qrTagStudio/GenerationQueue";
import TagContentConfig from "../../components/stock-in/qrTagStudio/TagContentConfig";
import QrPayloadPanel from "../../components/stock-in/qrTagStudio/QrPayloadPanel";
import PrintEngineConfig from "../../components/stock-in/qrTagStudio/PrintEngineConfig";
import TagRoll from "../../components/stock-in/qrTagStudio/TagRoll";
import A4SheetPreview from "../../components/stock-in/qrTagStudio/A4SheetPreview";
import PreviewFilterBar from "../../components/stock-in/qrTagStudio/PreviewFilterBar";
import ActionBar from "../../components/stock-in/qrTagStudio/ActionBar";
import { useTagPresetApi } from "../../hooks/useTagPresetApi";
import { useSerialCountersApi } from "../../hooks/useStockInChallansApi";
import { getVariantKey } from "../../utils/variantKey";
import { getVariantDisplayCode } from "../../utils/variantDisplay";
import {
  aggregateRows,
  buildTagList,
  computeVariantRow,
  defaultFieldState,
  fieldCapacity,
  flagsForTag,
  labelDims,
} from "../../utils/qrTagStudio";

const FIRM_LABEL = "SHAKSHAM'S FASHIONS";

const formatDdMmYy = (isoDate) => {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.split("-");
  return `${d}-${m}-${y.slice(2)}`;
};

const QrTagStudioStep = ({
  selectedVariants,
  variantTotals,
  configs,
  qcByKey,
  jobber,
  challanNo,
  challanDate,
  defectAction,
  printStrategy,
  tagParentChild,
  tagLoose,
  onToggleParentChild,
  onToggleLoose,
  perVariantSettings,
  onToggleVariantIncluded,
  onToggleVariantChildTags,
  printer,
  printerId,
  onPrinterChange,
  onTestPrint,
  onPrintConfigChange,
  printMode,
  onPrintModeChange,
}) => {
  const [activeTab, setActiveTab] = useState("parent");
  const [engine, setEngine] = useState("a4");
  const [thermalPreset, setThermalPreset] = useState("50x30");
  const [a4Preset, setA4Preset] = useState("40");
  const [a4StartAt, setA4StartAt] = useState(1);
  const [qrmm, setQrmm] = useState(17);
  const [typography, setTypography] = useState("standard");
  const [fields, setFields] = useState(defaultFieldState);
  const [filter, setFilter] = useState("all");
  const [zoom, setZoom] = useState(1);
  const { mutateAsync: savePreset, isPending: isSavingPreset } = useTagPresetApi();

  const toggleField = (tab, key) => {
    setFields((prev) => ({ ...prev, [tab]: { ...prev[tab], [key]: !prev[tab][key] } }));
  };

  // Normalizes selected variants + their live Step 2 (Set Matrix) totals + Step 3 (QC &
  // Defect) results into the flat shape every panel below reads from — the single place
  // this step touches shared wizard state.
  const variants = useMemo(
    () =>
      selectedVariants.map((variant) => {
        const key = getVariantKey(variant);
        const totals = variantTotals[key] ?? { setsTotal: 0, looseTotal: 0, piecesPerSet: 0, garmentsTotal: 0, sizeLabels: [], sizes: [] };
        const qc = qcByKey[key] ?? { passed: totals.garmentsTotal, defects: 0 };
        // Physical semi-set bundle instances for this variant — every one gets its own
        // parent tag alongside full sets (see computeVariantRow's parentTags), same as the
        // mock's countFor: `p += sets + semi`.
        const semiSetsTotal = (configs[key]?.bundles ?? []).reduce((sum, bundle) => sum + (Number(bundle.quantity) || 0), 0);
        return {
          key,
          colorVariantId: configs[key]?.colorVariantId,
          designId: variant.designId,
          colorName: variant.colorName,
          colorHex: variant.colorHex,
          code: getVariantDisplayCode(variant),
          designCode: variant.designCode,
          designName: variant.designName,
          sellingPricePerPiece: variant.sellingPricePerPiece,
          setsTotal: totals.setsTotal,
          semiSetsTotal,
          looseTotal: totals.looseTotal,
          piecesPerSet: totals.piecesPerSet,
          sizeLabels: totals.sizeLabels,
          sizes: totals.sizes ?? [],
          qcPassed: Number(qc.passed) || 0,
          qcDefects: Number(qc.defects) || 0,
        };
      }),
    [selectedVariants, variantTotals, qcByKey, configs]
  );

  const rows = useMemo(() => variants.map((v) => computeVariantRow(v, printStrategy, perVariantSettings)), [
    variants,
    printStrategy,
    perVariantSettings,
  ]);
  const totals = useMemo(() => aggregateRows(rows), [rows]);

  const primaryVariant =
    variants.find((v) => (perVariantSettings[v.key] ?? { included: true }).included !== false) ?? variants[0];

  const sampleSize = primaryVariant?.sizeLabels?.[0] ?? "-";
  const setSuffix = primaryVariant ? String(primaryVariant.setsTotal).padStart(3, "0") : "000";
  const parentSetId = primaryVariant ? `SET-${primaryVariant.code}-${setSuffix}` : "SET-NONE";
  const childId = primaryVariant ? `${primaryVariant.code}-${sampleSize}-01` : "—";
  const currentTagId = activeTab === "parent" ? parentSetId : activeTab === "child" ? childId : `LSE-${primaryVariant?.code ?? "NONE"}-0001`;

  const capacity = fieldCapacity(engine, thermalPreset, a4Preset, typography);
  const dims = labelDims(engine, thermalPreset, a4Preset);
  const fieldsOnCount = (kind) => Object.values(fields[kind]).filter(Boolean).length;

  // Every physical tag this batch will actually produce — real per-tag composition/size,
  // never one sample repeated (see buildTagList's doc comment for how this can differ
  // slightly from the QC-adjusted "child" total in the Generation Queue table above).
  const serialCountersQuery = useSerialCountersApi(variants.map((v) => v.colorVariantId));
  // Next free serial per colour variant — labels continue after the last number ever issued.
  const serialStarts = useMemo(
    () =>
      Object.fromEntries(
        (serialCountersQuery.data?.data ?? []).map((row) => [row.colorVariantId, { set: row.lastSetSerial + 1, piece: row.lastPieceSerial + 1 }])
      ),
    [serialCountersQuery.data]
  );
  const allTags = useMemo(
    () => buildTagList(variants, configs, printStrategy, perVariantSettings, serialStarts),
    [variants, configs, printStrategy, perVariantSettings, serialStarts]
  );

  const taggedTags = useMemo(
    () => allTags.map((tag) => ({ ...tag, flags: flagsForTag(engine, thermalPreset, a4Preset, typography, qrmm, fieldsOnCount(tag.kind)) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allTags, engine, thermalPreset, a4Preset, typography, qrmm, fields]
  );

  const filteredTags = useMemo(() => {
    if (filter === "all") return taggedTags;
    if (filter === "issues") return taggedTags.filter((tag) => tag.flags.length > 0);
    return taggedTags.filter((tag) => tag.kind === filter);
  }, [taggedTags, filter]);

  const buildTagData = (tag) => {
    const v = tag.variant;
    return {
      firm: FIRM_LABEL,
      designCode: v.designCode,
      designName: v.designName,
      variantName: (v.colorName ?? "").toUpperCase(),
      composition: (tag.composition ?? []).join(" · "),
      piecesPerSet: tag.piecesPerSet ?? 0,
      isSemiSet: Boolean(tag.isSemiSet),
      jobber: jobber?.name ? `#${jobber.name.toUpperCase()}` : "UNASSIGNED",
      piecePrice: `₹ ${(v.sellingPricePerPiece ?? 0).toLocaleString("en-IN")}`,
      date: formatDdMmYy(challanDate),
      size: tag.size,
      parentSetId: tag.parentId,
      pieceId: tag.code,
    };
  };

  const tagData = {
    firm: FIRM_LABEL,
    designCode: primaryVariant?.designCode ?? "—",
    designName: primaryVariant?.designName ?? "—",
    variantName: (primaryVariant?.colorName ?? "—").toUpperCase(),
    composition: primaryVariant?.sizeLabels?.join(" · ") || "—",
    piecesPerSet: primaryVariant?.piecesPerSet ?? 0,
    jobber: jobber?.name ? `#${jobber.name.toUpperCase()}` : "UNASSIGNED",
    piecePrice: `₹ ${(primaryVariant?.sellingPricePerPiece ?? 0).toLocaleString("en-IN")}`,
    date: formatDdMmYy(challanDate),
    size: sampleSize,
    parentSetId,
    pieceId: currentTagId,
    printerShort: printer.split(" [")[0]?.split(" ").slice(0, 2).join(" ") ?? printer,
    childQrValue: childId,
  };

  const mediaUsage =
    engine === "thermal"
      ? `${((totals.total * (dims.h + 3)) / 1000).toFixed(1)} m`
      : `${Math.ceil((totals.total + Math.max(0, Number(a4StartAt || 1) - 1)) / (dims.c * dims.r))} sheets`;

  const issueCount = taggedTags.filter((tag) => tag.flags.length > 0).length;

  const handleSavePreset = async () => {
    const designId = primaryVariant?.designId;
    if (!designId) {
      toast.error("Add at least one variant before saving a preset.");
      return;
    }
    try {
      await savePreset({
        designId,
        presetName: `${primaryVariant.designCode} — ${engine === "thermal" ? thermalPreset : `A4 ${a4Preset}`}`,
        mediaSize: engine === "thermal" ? thermalPreset : `A4-${a4Preset}`,
        defaultPrinterId: printerId ?? undefined,
        config: { engine, thermalPreset, a4Preset, qrmm, typography, fields },
      });
      toast.success("Tag preset saved for this design.");
    } catch (error) {
      toast.error(error?.message ?? "Couldn't save the preset.");
    }
  };

  // Hands the studio's choices up: the print that runs after registration draws the saved tags
  // with these same fields, media and firm header, and the serial starts let the backend reject
  // the inward if the numbers previewed here have moved on meanwhile.
  useEffect(() => {
    onPrintConfigChange?.({
      engine,
      thermalPreset,
      a4Preset,
      a4StartAt,
      qrmm,
      typography,
      fields,
      firm: FIRM_LABEL,
      jobber: jobber?.name ? `#${jobber.name.toUpperCase()}` : "UNASSIGNED",
      date: formatDdMmYy(challanDate),
      serialStarts: Object.fromEntries(variants.map((v) => [v.key, serialStarts[v.colorVariantId]]).filter(([, start]) => start)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, thermalPreset, a4Preset, a4StartAt, qrmm, typography, fields, jobber?.name, challanDate, serialStarts]);

  return (
    <div className="space-y-6">
      {(challanNo || jobber?.name) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-600">
          {challanNo && <span>{challanNo}</span>}
          {challanNo && jobber?.name && <span className="text-slate-300">·</span>}
          {jobber?.name && <span>{jobber.name}</span>}
          <span className="text-slate-300">·</span>
          <span className="font-semibold text-slate-800">{variants.reduce((sum, v) => sum + v.qcPassed, 0)} pcs passed QC</span>
        </div>
      )}

      <div>
        <div className="mb-1 flex items-baseline gap-2">
          <h3 className="text-[14.5px] font-bold tracking-tight text-slate-900">1 · Tagging strategy</h3>
          <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-px font-mono text-[10px] font-bold tracking-wide text-emerald-700">
            BOTH ON BY DEFAULT
          </span>
        </div>
        {/* <p className="mb-3.5 max-w-[74ch] text-[13px] text-slate-500">
          This choice sets how many labels get printed and how much hand-applying the godown has to do. Everything
          below reacts to it.
        </p> */}
        {variants.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            No variants added yet — go back to Inward Details and Set Matrix first.
          </div>
        ) : (
          <StrategyCards
            variants={variants}
            perVariantSettings={perVariantSettings}
            tagParentChild={tagParentChild}
            tagLoose={tagLoose}
            onToggleParentChild={onToggleParentChild}
            onToggleLoose={onToggleLoose}
          />
        )}
      </div>

      {variants.length > 0 && (
        <>
          <details className="group overflow-hidden rounded-xl border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-slate-50 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
              <h3 className="text-sm font-bold tracking-tight text-slate-900">2 · Generation queue</h3>
              <span className="ml-auto text-xs text-slate-500">
                {totals.total} tags · {new Set(variants.map((v) => v.designId)).size} design
                {new Set(variants.map((v) => v.designId)).size === 1 ? "" : "s"} · {rows.filter((row) => row.included).length} of {rows.length} variants
              </span>
              <span className="text-slate-400 transition-transform group-open:rotate-180">▾</span>
            </summary>
            <div className="border-t border-slate-200 p-4">
              <GenerationQueue
                variants={variants}
                strategy={printStrategy}
                perVariantSettings={perVariantSettings}
                onToggleIncluded={onToggleVariantIncluded}
                onToggleChildTags={onToggleVariantChildTags}
                defectAction={defectAction}
              />
            </div>
          </details>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <div className="space-y-4">
              <TagContentConfig activeTab={activeTab} onTabChange={setActiveTab} fields={fields} onToggleField={toggleField} capacity={capacity} />
              <QrPayloadPanel code={currentTagId} />
              <PrintEngineConfig
                engine={engine}
                onEngineChange={setEngine}
                thermalPreset={thermalPreset}
                onThermalPresetChange={setThermalPreset}
                a4Preset={a4Preset}
                onA4PresetChange={setA4Preset}
                printer={printer}
                onPrinterChange={onPrinterChange}
                onTestPrint={() => onTestPrint(currentTagId)}
                qrmm={qrmm}
                onQrmmChange={setQrmm}
                typography={typography}
                onTypographyChange={setTypography}
              />
              {engine === "a4" && (
                <div className="rounded-[10px] border border-slate-200 bg-white p-4">
                  <label className="mb-1.5 block text-[11.5px] font-semibold text-slate-600">Start at label no.</label>
                  <input
                    type="number"
                    min={1}
                     value={a4StartAt}
                     max={dims.c * dims.r}
                    onChange={(event) => setA4StartAt(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-[13px] text-slate-900"
                  />
                  <p className="mt-2 text-[12.3px] leading-snug text-slate-500">
                    Starts at label {a4StartAt || 1}, leaving earlier cells blank on a part-used sheet.
                  </p>
                </div>
              )}
            </div>

            <div className="sticky top-4">
              <div className="overflow-hidden rounded-[10px] border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h3 className="text-[12.5px] font-bold tracking-tight text-slate-900">Live preview — every tag in the job</h3>
                  <span className="text-[11.5px] text-slate-500">
                    {tagData.printerShort} · {dims.w} × {dims.h} mm
                  </span>
                </div>
                <PreviewFilterBar tags={taggedTags} filter={filter} onFilterChange={setFilter} zoom={zoom} onZoomChange={setZoom} />
                <div
                  className="theme-light max-h-[560px] overflow-y-auto"
                  style={{
                    backgroundColor: "#E2E8F0",
                    backgroundImage:
                      "linear-gradient(45deg,#DBE2EA 25%,transparent 25%,transparent 75%,#DBE2EA 75%),linear-gradient(45deg,#DBE2EA 25%,transparent 25%,transparent 75%,#DBE2EA 75%)",
                    backgroundSize: "14px 14px",
                    backgroundPosition: "0 0, 7px 7px",
                  }}
                >
                  {engine === "thermal" ? (
                    <TagRoll
                      tags={filteredTags}
                      buildTagData={buildTagData}
                      fields={fields}
                      qrmm={qrmm}
                      typography={typography}
                      zoom={zoom}
                      printerShort={tagData.printerShort}
                    />
                  ) : (
                    <div className="p-4">
                      <A4SheetPreview tags={filteredTags} a4Preset={a4Preset} startAt={a4StartAt} buildTagData={buildTagData} fields={fields} qrmm={qrmm} />
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[11.5px] text-slate-500">
                  <span>
                    Label <b className="font-mono font-bold text-slate-900">{dims.w} × {dims.h} mm</b>
                  </span>
                  <span>
                    QR <b className="font-mono font-bold text-slate-900">{qrmm} mm</b>
                  </span>
                  <span>
                    Fields <b className="font-mono font-bold text-slate-900">{fieldsOnCount(activeTab)}</b>
                  </span>
                  <span
                    className={`font-semibold ${
                      qrmm < 12 ? "text-red-600" : qrmm < 15 ? "text-amber-600" : "text-emerald-600"
                    }`}
                  >
                    {qrmm < 12 ? "✕ Scan risk: high" : qrmm < 15 ? "⚠ Scan risk: marginal" : "✓ Scan-safe"}
                  </span>
                </div>
              </div>
              <p className="mt-3 max-w-[78ch] text-[12.3px] text-slate-500">
                <b className="text-slate-900">Preview is size-accurate.</b> Scroll the whole job before printing — every
                tag above renders its own real content, not one sample repeated. The QR codes here are placeholders:
                each tag's scannable code is issued when you register, and the printed labels carry that code.
              </p>
            </div>
          </div>

          <ActionBar
            totals={{
              tagsQueued: totals.total,
              media: mediaUsage,
              applyTime: `~${Math.max(1, Math.round((totals.parent * 4 + totals.child * 7 + totals.loose * 7) / 60))} min`,
              issues: issueCount,
            }}
            isSavingPreset={isSavingPreset}
            onSavePreset={handleSavePreset}
            printMode={printMode}
            onPrintModeChange={onPrintModeChange}
          />
        </>
      )}
    </div>
  );
};

export default QrTagStudioStep;
