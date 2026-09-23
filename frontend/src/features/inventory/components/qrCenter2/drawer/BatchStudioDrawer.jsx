import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import Drawer from "./Drawer.jsx";
import { ActionButton, EmptyState } from "../shared/primitives.jsx";
import StudioStrategy from "../studio/StudioStrategy.jsx";
import StudioQueue from "../studio/StudioQueue.jsx";
import SheetJob from "../studio/SheetJob.jsx";
import TagContentConfig from "../../stock-in/qrTagStudio/TagContentConfig.jsx";
import QrPayloadPanel from "../../stock-in/qrTagStudio/QrPayloadPanel.jsx";
import PrintEngineConfig from "../../stock-in/qrTagStudio/PrintEngineConfig.jsx";
import TagRoll from "../../stock-in/qrTagStudio/TagRoll.jsx";
import A4SheetPreview from "../../stock-in/qrTagStudio/A4SheetPreview.jsx";
import PreviewFilterBar from "../../stock-in/qrTagStudio/PreviewFilterBar.jsx";
import ConfirmedA4QrPrintSheet from "../../stock-in/qrTagStudio/ConfirmedA4QrPrintSheet.jsx";
import { useQrBatchApi } from "../../../hooks/useQrBatchApi.js";
import { useTagPresetApi } from "../../../hooks/useTagPresetApi.js";
import { confirmQrBatchPrintApi, getQrCenterReferenceApi, issueQrBatchApi } from "../../../services/qrCenter.api.js";
import { submitA4QrPrintJob } from "../../../services/localPrintAgent.api.js";
import { buildConfirmedLabelLines } from "../../../utils/confirmedLabelLines.js";
import { defaultFieldState, fieldCapacity, labelDims } from "../../../utils/qrTagStudio.js";
import {
    FIRM_LABEL,
    buildTagData,
    formatDdMmYy,
    passedQcPieces,
    queuedEntries,
    toDisplayTag,
    toLabelItem,
} from "../../../utils/qrBatchStudio.js";

const PREVIEW_BACKGROUND = {
    backgroundColor: "#E2E8F0",
    backgroundImage: "linear-gradient(45deg,#DBE2EA 25%,transparent 25%,transparent 75%,#DBE2EA 75%),linear-gradient(45deg,#DBE2EA 25%,transparent 25%,transparent 75%,#DBE2EA 75%)",
    backgroundSize: "14px 14px",
    backgroundPosition: "0 0, 7px 7px",
};

const NOTE_TONES = {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

// The Configure & print studio for one stock-in batch — the same QR Tag Studio Stock Inwarding
// ends with, run against what that batch already holds. State lives in StudioSession so every
// open starts clean (the parent bumps `sessionKey`).
export default function BatchStudioDrawer({ open, batchId, sessionKey, onClose }) {
    if (!batchId) return null;
    return <StudioSession key={sessionKey} open={open} batchId={batchId} onClose={onClose} />;
}

function StudioSession({ open, batchId, onClose }) {
    const queryClient = useQueryClient();
    const { data: response, isLoading, isError, error, refetch } = useQrBatchApi(batchId, { enabled: open });
    const batch = response?.data?.batch;
    const variants = useMemo(() => response?.data?.variants ?? [], [response]);

    const { data: referenceResponse } = useQuery({ queryKey: ["qr-center", "reference"], queryFn: getQrCenterReferenceApi, enabled: open });
    const printers = referenceResponse?.data?.printers ?? [];
    const [printerChoice, setPrinterChoice] = useState(null);
    const printerId = printerChoice ?? (printers.find((p) => p.isActive) ?? printers[0])?.id ?? null;
    const printer = printers.find((p) => p.id === printerId);
    const printerOptions = printers.length
        ? printers.map((p) => ({ value: String(p.id), label: p.location ? `${p.name} [${p.location}]` : p.name }))
        : [{ value: "", label: "Browser print dialog" }];

    // What the studio is set to print.
    const [tagParentChild, setTagParentChild] = useState(true);
    const [tagLoose, setTagLoose] = useState(true);
    const [included, setIncluded] = useState({});
    const [reprintChoice, setReprintChoice] = useState(null);
    const reprint = reprintChoice ?? batch?.printStatus === "done";
    const strategy = { tagParentChild, tagLoose, included, reprint };

    // How it prints.
    const [activeTab, setActiveTab] = useState("parent");
    const [fields, setFields] = useState(defaultFieldState);
    const [engine, setEngine] = useState("a4");
    const [thermalPreset, setThermalPreset] = useState("50x30");
    const [a4Preset, setA4Preset] = useState("40");
    const [a4StartAt, setA4StartAt] = useState(1);
    const [qrmm, setQrmm] = useState(17);
    const [typography, setTypography] = useState("standard");
    const [filter, setFilter] = useState("all");
    const [zoom, setZoom] = useState(1);

    const [busy, setBusy] = useState(false);
    const [sheetJob, setSheetJob] = useState(null);
    const [confirmedPrint, setConfirmedPrint] = useState(null);
    const { mutateAsync: savePreset, isPending: isSavingPreset } = useTagPresetApi();

    const fieldsOnCount = (kind) => Object.values(fields[kind]).filter(Boolean).length;
    const toggleField = (tab, key) => setFields((prev) => ({ ...prev, [tab]: { ...prev[tab], [key]: !prev[tab][key] } }));
    const dims = labelDims(engine, thermalPreset, a4Preset);
    const capacity = fieldCapacity(engine, thermalPreset, a4Preset, typography);
    const jobber = batch?.jobberName ?? "";
    const stockDate = batch?.stockDate;
    const tagData = (tag) => buildTagData(tag, { jobber, date: stockDate });
    const displayOptions = { engine, thermalPreset, a4Preset, typography, qrmm, fieldsOnCount };

    const entries = useMemo(
        () => queuedEntries(variants, strategy),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [variants, tagParentChild, tagLoose, included, reprint],
    );
    const taggedTags = useMemo(
        () => entries.map(({ variant, tag }) => toDisplayTag(variant, tag, displayOptions)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [entries, engine, thermalPreset, a4Preset, typography, qrmm, fields],
    );
    const filteredTags = useMemo(() => {
        if (filter === "all") return taggedTags;
        if (filter === "issues") return taggedTags.filter((tag) => tag.flags.length > 0);
        return taggedTags.filter((tag) => tag.kind === filter);
    }, [taggedTags, filter]);

    // The preview's Parent / Child / Loose filter also narrows what is printed; All (and Issues) print everything.
    const scopeKind = ["parent", "child", "loose"].includes(filter) ? filter : null;
    const queued = scopeKind ? entries.filter(({ tag }) => tag.kind === scopeKind).length : entries.length;
    const issueCount = taggedTags.filter((tag) => tag.flags.length > 0).length;
    const skip = Math.max(0, Number(a4StartAt || 1) - 1);
    const media = engine === "thermal"
        ? `${((queued * (dims.h + 3)) / 1000).toFixed(1)} m`
        : `${queued ? Math.ceil((queued + skip) / (dims.c * dims.r)) : 0} sheets`;

    // Counts shown on the strategy cards: everything each switch would cover, and how many of
    // those still need a code.
    const everything = queuedEntries(variants, { tagParentChild: true, tagLoose: true, included, reprint });
    const counts = {
        parentChild: everything.filter(({ tag }) => tag.kind !== "loose").length,
        loose: everything.filter(({ tag }) => tag.kind === "loose").length,
    };
    const newCounts = {
        parentChild: everything.filter(({ tag }) => tag.kind !== "loose" && !tag.code).length,
        loose: everything.filter(({ tag }) => tag.kind === "loose" && !tag.code).length,
    };

    const sampleEntry = entries.find(({ tag }) => tag.kind === activeTab) ?? variants.flatMap((variant) => variant.tags.map((tag) => ({ variant, tag }))).find(({ tag }) => tag.kind === activeTab);
    const sampleCode = sampleEntry?.tag.displayCode ?? "—";

    const printedCount = batch?.printedCount ?? 0;
    const tagCount = batch?.tagCount ?? 0;
    const notTagged = batch?.notTaggedCount ?? 0;

    const note = (() => {
        if (!batch) return null;
        const ungenerated = notTagged > 0
            ? ` ${notTagged} more tag${notTagged === 1 ? "" : "s"} (the pieces of sets and any loose stock) have no code yet — they are given theirs the moment you print.`
            : "";
        if (batch.printStatus === "pending") {
            return { tone: "amber", body: <><b>{printedCount === 0 && tagCount > 0 ? "No tags have been printed for this batch yet." : "Tags for this batch were skipped at stock-in."}</b> The stock is already registered against inventory — printing now only produces the labels. Codes that were issued when the batch was saved keep the id they have always had.{ungenerated}</> };
        }
        if (batch.printStatus === "partial") {
            return { tone: "blue", body: <><b>{printedCount} of {tagCount} tags are already printed.</b> Only the missing labels are queued below. The stock is already registered, and every tag keeps the code issued when it was created.{ungenerated}</> };
        }
        return { tone: "green", body: <></> };
    })();

    const withDefects = variants.filter((variant) => variant.defects > 0);
    const narrative = withDefects.length
        ? `Read from the batch's saved QC results. ${withDefects.map((variant) => `${variant.defects} defective ${variant.variant.colorName} pc${variant.defects === 1 ? " was" : "s were"} logged at QC`).join("; ")} — their tags are kept so seconds can be scanned too.`
        : "No QC defects logged for this batch — every count below matches the batch's Set Matrix quantities exactly.";

    // ---- printing -------------------------------------------------------------------------

    const content = { engine, a4Preset, a4StartAt, qrmm, fields, firm: FIRM_LABEL, jobber: jobber ? `#${jobber.toUpperCase()}` : "UNASSIGNED", date: formatDdMmYy(stockDate) };
    const sheet = { engine, a4Preset, a4StartAt, thermalPreset, fields, qrmm, typography };

    // Gives every tag in this job its code (creating the piece tags that never had one) and returns
    // the labels. Nothing is marked printed yet.
    const issueTags = async () => {
        const result = await issueQrBatchApi(batchId, {
            parentChild: tagParentChild,
            loose: tagLoose,
            transactionIds: variants.filter((variant) => included[variant.transactionId] !== false).map((variant) => variant.transactionId),
            reprint,
            kinds: scopeKind ? [scopeKind] : undefined,
        });
        queryClient.setQueryData(["qr-center", "batch", batchId], { ...result, data: { batch: result.data.batch, variants: result.data.variants } });
        queryClient.invalidateQueries({ queryKey: ["qr-center", "batches"] });
        const issuedTags = queuedEntries(result.data.variants, strategy).filter(({ tag }) => !scopeKind || tag.kind === scopeKind).map(({ variant, tag }) => toDisplayTag(variant, tag, displayOptions));
        return { printItems: result.data.printItems, tags: issuedTags };
    };

    const recordPrinted = async (printItems, message) => {
        try {
            await confirmQrBatchPrintApi(batchId, { stockItemQrIds: printItems.map((item) => item.qrId), printerId: printerId ?? undefined });
            await queryClient.invalidateQueries({ queryKey: ["qr-center"] });
            await queryClient.invalidateQueries({ queryKey: ["stock-in"] });
            toast.success(message);
            onClose();
        } catch (err) {
            toast.error(`${err.message} The labels were sent, but this batch could not be marked printed.`);
        }
    };

    const handleSendToPrinter = async () => {
        if (!queued || busy) return;
        setBusy(true);
        try {
            const { printItems, tags } = await issueTags();
            const summary = `${printItems.length} tag${printItems.length === 1 ? "" : "s"} for challan ${batch.challanNo}`;

            if (engine === "thermal") {
                setSheetJob({ mode: "print", tags, printItems, message: `${summary} sent to the printer.` });
                return;
            }

            // The local print agent can't import this app's code, so it gets the finished label lines.
            const items = printItems.map((item) => ({ ...item, labelLines: buildConfirmedLabelLines(item, content) }));
            try {
                const result = await submitA4QrPrintJob({ items, startAt: a4StartAt, content });
                await recordPrinted(printItems, `${summary} submitted to ${result.printer}.`);
            } catch (agentError) {
                toast.warning(`${agentError.message} Opening the browser print dialog as a fallback.`);
                setConfirmedPrint({ items, printItems, startAt: a4StartAt, content, message: `${summary} sent to the printer.` });
            }
        } catch (err) {
            toast.error(err?.message ?? "Couldn't prepare the tags for printing.");
            queryClient.invalidateQueries({ queryKey: ["qr-center"] });
        } finally {
            setBusy(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (!queued || busy) return;
        setBusy(true);
        try {
            const { tags } = await issueTags();
            setSheetJob({ mode: "pdf", tags });
        } catch (err) {
            toast.error(err?.message ?? "Couldn't prepare the tags for the PDF.");
        } finally {
            setBusy(false);
        }
    };

    // A test label is one real tag that already has a code — never a made-up one — and is not
    // recorded as printed.
    const handleTestPrint = async () => {
        const candidates = variants.flatMap((variant) => variant.tags.filter((tag) => tag.code).map((tag) => ({ variant, tag })));
        const entry = candidates.find(({ tag }) => tag.kind === activeTab) ?? candidates[0];
        if (!entry) {
            toast.info("None of this batch's tags has a code yet — print the batch once, then test prints use a real code.");
            return;
        }
        if (engine === "thermal") {
            setSheetJob({ mode: "print", tags: [toDisplayTag(entry.variant, entry.tag, displayOptions)], printItems: [], message: null });
            return;
        }
        const item = toLabelItem(entry.variant, entry.tag);
        item.labelLines = buildConfirmedLabelLines(item, content);
        try {
            const result = await submitA4QrPrintJob({ items: [item], startAt: a4StartAt, content });
            toast.success(`Test label (${entry.tag.displayCode}) sent to ${result.printer}.`);
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleSavePreset = async () => {
        const primary = variants.find((variant) => included[variant.transactionId] !== false) ?? variants[0];
        if (!primary) return;
        try {
            await savePreset({
                designId: primary.design.id,
                presetName: `${primary.design.code} — ${engine === "thermal" ? thermalPreset : `A4 ${a4Preset}`}`,
                mediaSize: engine === "thermal" ? thermalPreset : `A4-${a4Preset}`,
                defaultPrinterId: printerId ?? undefined,
                config: { engine, thermalPreset, a4Preset, qrmm, typography, fields },
            });
            toast.success("Tag preset saved for this design.");
        } catch (err) {
            toast.error(err?.message ?? "Couldn't save the preset.");
        }
    };

    const printedSheetDone = async () => {
        const job = sheetJob;
        setSheetJob(null);
        if (job?.printItems?.length) await recordPrinted(job.printItems, job.message);
    };

    // ---- layout ---------------------------------------------------------------------------

    const subtitle = batch ? [batch.challanNo, batch.stockDate, batch.jobberName].filter(Boolean).join(" · ") : "";
    const stat = (value, label, tone = "text-slate-900") => (
        <div>
            <div className={`font-mono text-base font-bold tabular-nums ${tone}`}>{value}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        </div>
    );

    const footer = (
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-6">
                {stat(queued, "Tags queued")}
                {stat(media, "Media")}
                {stat(issueCount, "Need attention", issueCount ? "text-amber-600" : "text-slate-900")}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <ActionButton size="sm" disabled={isSavingPreset || !batch} onClick={handleSavePreset}>{isSavingPreset ? "Saving…" : "Save as preset"}</ActionButton>
                <ActionButton size="sm" disabled={!queued || busy} onClick={handleDownloadPdf}>Download PDF</ActionButton>
                <ActionButton size="sm" onClick={onClose}>Cancel</ActionButton>
                <ActionButton size="sm" variant="primary" disabled={!queued || busy} onClick={handleSendToPrinter}>{busy ? "Preparing…" : "Send to printer →"}</ActionButton>
            </div>
        </div>
    );

    return (
        <>
            <Drawer wide open={open} onClose={onClose} title="Configure & print tags" subtitle={subtitle} footer={footer}>
                {open && isLoading && <EmptyState>Loading the batch…</EmptyState>}
                {open && isError && (
                    <EmptyState title="Couldn't load this batch">
                        {error?.message}
                        <div className="mt-3"><ActionButton size="sm" onClick={() => refetch()}>Try again</ActionButton></div>
                    </EmptyState>
                )}

                {open && batch && (
                    <div className="space-y-6">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-600">
                            <span>{batch.challanNo}</span>
                            {batch.jobberName && <><span className="text-slate-300">·</span><span>{batch.jobberName}</span></>}
                            {batch.serialLabel && <><span className="text-slate-300">·</span><span>{batch.serialLabel}</span></>}
                            <span className="text-slate-300">·</span>
                            <span className="font-semibold text-slate-800">{passedQcPieces(variants)} pcs passed QC</span>
                        </div>

                        <div>
                            <div className="mb-1 flex items-baseline gap-2">
                                <h3 className="text-[14.5px] font-bold tracking-tight text-slate-900">1 · Tagging strategy</h3>
                                <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-px font-mono text-[10px] font-bold tracking-wide text-emerald-700">BOTH ON BY DEFAULT</span>
                            </div>
                            <StudioStrategy
                                counts={counts}
                                newCounts={newCounts}
                                tagParentChild={tagParentChild}
                                tagLoose={tagLoose}
                                onToggleParentChild={() => setTagParentChild((on) => !on)}
                                onToggleLoose={() => setTagLoose((on) => !on)}
                            />
                        </div>

                        <details className="group overflow-hidden rounded-xl border border-slate-200 bg-white" open>
                            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-slate-50 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                                <h3 className="text-sm font-bold tracking-tight text-slate-900">2 · Generation queue</h3>
                                <span className="order-3 w-full text-xs text-slate-500 sm:order-none sm:ml-auto sm:w-auto">
                                    {queued} tags · {new Set(variants.map((variant) => variant.design.id)).size} design{new Set(variants.map((variant) => variant.design.id)).size === 1 ? "" : "s"} · {variants.filter((variant) => included[variant.transactionId] !== false).length} of {variants.length} variants
                                </span>
                                <span className="text-slate-400 transition-transform group-open:rotate-180">▾</span>
                            </summary>
                            <div className="border-t border-slate-200 p-4">
                                <StudioQueue
                                    variants={variants}
                                    strategy={strategy}
                                    narrative={narrative}
                                    printedCount={printedCount}
                                    tagCount={tagCount}
                                    onToggleIncluded={(transactionId) => setIncluded((prev) => ({ ...prev, [transactionId]: prev[transactionId] === false }))}
                                    reprintBox={printedCount > 0 && (
                                        <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-[12.8px] text-slate-700 ${reprint ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200 bg-white"}`}>
                                            <input type="checkbox" checked={reprint} onChange={(event) => setReprintChoice(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-emerald-600" />
                                            <span>
                                                <b className="text-slate-900">Also reprint the {printedCount} tag{printedCount === 1 ? "" : "s"} already printed</b>
                                                <span className="block text-[11.8px] text-slate-500">Same codes as before — for damaged or lost labels. {reprint ? "Included in this job." : "Left out: only missing labels print."}</span>
                                            </span>
                                        </label>
                                    )}
                                />
                            </div>
                        </details>

                        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
                            <div className="space-y-4">
                                <TagContentConfig activeTab={activeTab} onTabChange={setActiveTab} fields={fields} onToggleField={toggleField} capacity={capacity} />
                                <QrPayloadPanel code={sampleCode} />
                                <PrintEngineConfig
                                    engine={engine}
                                    onEngineChange={setEngine}
                                    thermalPreset={thermalPreset}
                                    onThermalPresetChange={setThermalPreset}
                                    a4Preset={a4Preset}
                                    onA4PresetChange={setA4Preset}
                                    printer={String(printerId ?? "")}
                                    printerOptions={printerOptions}
                                    onPrinterChange={(value) => setPrinterChoice(value ? Number(value) : null)}
                                    onTestPrint={handleTestPrint}
                                    qrmm={qrmm}
                                    onQrmmChange={setQrmm}
                                    typography={typography}
                                    onTypographyChange={setTypography}
                                />
                                {engine === "a4" && (
                                    <div className="rounded-[10px] border border-slate-200 bg-white p-4">
                                        <label className="mb-1.5 block text-[11.5px] font-semibold text-slate-600" htmlFor="qr-batch-start-at">Start at label no.</label>
                                        <input
                                            id="qr-batch-start-at"
                                            type="number"
                                            min={1}
                                            max={dims.c * dims.r}
                                            value={a4StartAt}
                                            onChange={(event) => setA4StartAt(event.target.value)}
                                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-[13px] text-slate-900"
                                        />
                                        <p className="mt-2 text-[12.3px] leading-snug text-slate-500">Starts at label {a4StartAt || 1}, leaving earlier cells blank on a part-used sheet.</p>
                                    </div>
                                )}
                            </div>

                            <div className="lg:sticky lg:top-0">
                                <div className="overflow-hidden rounded-[10px] border border-slate-200 bg-white">
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                                        <h3 className="text-[12.5px] font-bold tracking-tight text-slate-900">Live preview — every tag in the job</h3>
                                        <span className="text-[11.5px] text-slate-500">
                                            {engine === "a4" ? "A4 Laser" : (printer?.name ?? "Thermal roll")} · {dims.w} × {dims.h} mm
                                        </span>
                                    </div>
                                    <PreviewFilterBar tags={taggedTags} filter={filter} onFilterChange={setFilter} zoom={zoom} onZoomChange={setZoom} />
                                    <div className="theme-light max-h-[560px] overflow-y-auto" style={PREVIEW_BACKGROUND}>
                                        {taggedTags.length === 0 ? (
                                            <div className="px-4 py-10 text-center text-[13px] text-slate-500">
                                                <b className="block text-slate-700">Nothing to print</b>
                                                {!tagParentChild && !tagLoose
                                                    ? "Both tag types are off."
                                                    : printedCount > 0 && !reprint
                                                        ? "Every tag in this selection is already printed — tick “Also reprint” to print duplicates."
                                                        : "Turn a variant back on in the generation queue."}
                                            </div>
                                        ) : engine === "thermal" ? (
                                            <TagRoll tags={filteredTags} buildTagData={tagData} fields={fields} qrmm={qrmm} typography={typography} zoom={zoom} printerShort={(printer?.name ?? "THERMAL").split(" ").slice(0, 2).join(" ")} />
                                        ) : (
                                            <div className="p-4">
                                                <A4SheetPreview tags={filteredTags} a4Preset={a4Preset} startAt={a4StartAt} buildTagData={tagData} fields={fields} qrmm={qrmm} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[11.5px] text-slate-500">
                                        <span>Label <b className="font-mono font-bold text-slate-900">{dims.w} × {dims.h} mm</b></span>
                                        <span>QR <b className="font-mono font-bold text-slate-900">{qrmm} mm</b></span>
                                        <span>Fields <b className="font-mono font-bold text-slate-900">{fieldsOnCount(activeTab)}</b></span>
                                        <span className={`font-semibold ${qrmm < 12 ? "text-red-600" : qrmm < 15 ? "text-amber-600" : "text-emerald-600"}`}>
                                            {qrmm < 12 ? "✕ Scan risk: high" : qrmm < 15 ? "⚠ Scan risk: marginal" : "✓ Scan-safe"}
                                        </span>
                                    </div>
                                </div>
                                <p className="mt-3 max-w-[78ch] text-[12.3px] text-slate-500">
                                    <b className="text-slate-900">Preview is size-accurate.</b> Scroll the whole job before printing — every tag above renders its own real content, not one sample repeated. A tag marked as new is given its code when you print.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </Drawer>

            {sheetJob && (
                <SheetJob
                    job={sheetJob}
                    sheet={sheet}
                    buildTagData={tagData}
                    fileName={`qr-tags-${batch?.challanNo || "stock-in"}.pdf`}
                    onPrinted={printedSheetDone}
                    onDone={() => { setSheetJob(null); toast.success("PDF downloaded. These tags stay unprinted until you send them to a printer."); }}
                    onError={(err) => { setSheetJob(null); toast.error(err?.message ?? "Couldn't create the PDF."); }}
                />
            )}

            {confirmedPrint && (
                <ConfirmedA4QrPrintSheet
                    items={confirmedPrint.items}
                    startAt={confirmedPrint.startAt}
                    content={confirmedPrint.content}
                    onAfterPrint={() => {
                        const job = confirmedPrint;
                        setConfirmedPrint(null);
                        recordPrinted(job.printItems, job.message);
                    }}
                />
            )}
        </>
    );
}
