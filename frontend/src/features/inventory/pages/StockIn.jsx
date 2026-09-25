import { buildConfirmedLabelLines } from "../utils/confirmedLabelLines";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "react-toastify";
import { ArrowLeft, Loader2 } from "lucide-react";

import StockInStepper from "../components/stock-in/StockInStepper";
import StockInWizardNavigation from "../components/stock-in/StockInWizardNavigation";
import ConfirmedA4QrPrintSheet from "../components/stock-in/qrTagStudio/ConfirmedA4QrPrintSheet";
import { useStockInWizard } from "../hooks/useStockInWizard";
import { useVariantStockConfigs } from "../hooks/useVariantStockConfigs";
import { useStockInRegisterApi } from "../hooks/useStockInRegisterApi";
import { useQueryClient } from "@tanstack/react-query";
import { useNextStockInSerialApi } from "../hooks/useStockInChallansApi";
import { useWizardKeyboardNav } from "../hooks/useWizardKeyboardNav";
import { confirmQrBatchPrintApi, issueQrBatchApi } from "../services/qrCenter.api.js";
import { submitA4QrPrintJob } from "../services/localPrintAgent.api.js";
import { useSaveStockInDraftApi, useStockInDraftApi } from "../hooks/useStockInDraftsApi";
import { buildStockInPayload } from "../utils/buildStockInPayload";
import { getVariantKey } from "../utils/variantKey";
import { NO_DEFECT_CATEGORY } from "../utils/qcDefects";
import { aggregateRows, computeVariantRow } from "../utils/qrTagStudio";
import { buildTagData as buildBatchTagData, queuedEntries, toDisplayTag } from "../utils/qrBatchStudio";
import SheetJob from "../components/qrCenter2/studio/SheetJob";
import InwardDetailsStep from "../steps/stockIn/InwardDetailsStep";
import SetMatrixStep from "../steps/stockIn/SetMatrixStep";
import QcDefectStep from "../steps/stockIn/QcDefectStep";
import QrTagStudioStep from "../steps/stockIn/QrTagStudioStep";
import SummaryStep from "../steps/stockIn/SummaryStep";

// "YYYY-MM-DD" in the user's own local calendar day — never via `new Date().toISOString()`,
// which reads UTC and can report yesterday's/tomorrow's date depending on the local offset.
function todayAsIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Mounted at /stock-in/new (fresh inward) and /stock-in/drafts/:draftId (resuming a draft saved
// server-side — see the Stock In dashboard). Every successful "Next Step" autosaves the draft at
// the step just reached, so the dashboard can list it and resume it at that exact step.
const StockIn = () => {
  const navigate = useNavigate();
  const { draftId: routeDraftId } = useParams();

  const [jobber, setJobber] = useState({ id: null, name: "" });
  const [challanNo, setChallanNo] = useState("");
  const [issuedChallanNo, setIssuedChallanNo] = useState("");
  const [challanDate, setChallanDate] = useState(todayAsIsoDate);
  const nextSerialQuery = useNextStockInSerialApi();
  const nextSerial = nextSerialQuery.data?.data?.serial;

  const [selectedVariants, setSelectedVariants] = useState([]);
  const {
    configs,
    ensureConfig,
    setTotalSetsReceived,
    setLoosePieces,
    addBundle,
    updateBundle,
    removeBundle,
    reset: resetConfigs,
    hydrate: hydrateConfigs,
  } = useVariantStockConfigs();

  // Per-variant derived totals (sets/loose/garments), reported up by each SetMatrixVariantCard
  // once it knows its own active sizes — single source of truth consumed by QC, QR Tag Studio
  // and Summary so every step stays dynamically linked to what was actually entered in Step 2.
  const [variantTotals, setVariantTotals] = useState({});
  const handleVariantTotalsChange = (key, totals) => {
    setVariantTotals((prev) => ({ ...prev, [key]: totals }));
  };

  // QC per variant. Only what the user typed is stored (defective count + category); passed is
  // always what Set Matrix received minus the defective pieces, so the two can never drift
  // apart — even when Step 2's quantities change afterwards.
  const [qcOverridesByKey, setQcOverridesByKey] = useState({});
  const qcByKey = useMemo(() => {
    const resolved = {};
    for (const [key, totals] of Object.entries(variantTotals)) {
      const override = qcOverridesByKey[key];
      const defects = Math.min(Math.max(Number(override?.defects) || 0, 0), totals.garmentsTotal);
      resolved[key] = {
        passed: totals.garmentsTotal - defects,
        defects,
        category: override?.category ?? NO_DEFECT_CATEGORY,
      };
    }
    return resolved;
  }, [variantTotals, qcOverridesByKey]);

  const handleQcFieldChange = (key, patch) => {
    setQcOverridesByKey((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const [defectAction, setDefectAction] = useState("seconds");
  const [qcRemarks, setQcRemarks] = useState("");

  // QR Tag Studio: two independent switches, both on by default. Parent + Child tags every set
  // / semi set and every piece in it; Loose pieces tags the odd pieces. Off never skips issuing
  // the codes or registering the stock — those labels are just printed later from QR Center.
  // Per-variant overrides here are only Include (and child tags for the legacy "custom" mode).
  const [tagParentChild, setTagParentChild] = useState(true);
  const [tagLoose, setTagLoose] = useState(true);
  const printStrategy = tagParentChild ? "parentChild" : "none";
  const [qrPerVariantSettings, setQrPerVariantSettings] = useState({});
  const [printer, setPrinter] = useState("A4 Laser Printer (4×10 · 40-Up)");
  // What happens to the labels after Register ("printer" | "pdf" | "later" — see ActionBar). Labels are only
  // ever printed from the saved tags, so every QR carries the short code a scan station looks up.
  const [printMode, setPrintMode] = useState("printer");
  const [printConfig, setPrintConfig] = useState({ engine: "a4", a4Preset: "40", a4StartAt: 1 });
  const [confirmedQrPrint, setConfirmedQrPrint] = useState(null);
  const [sheetJob, setSheetJob] = useState(null);
  // Physical dispatch is handled by the local print agent; the backend printer registry is
  // intentionally not used because its printer IDs do not identify the tester's OS queue.
  const printerId = undefined;

  const toggleVariantIncluded = (key) => {
    setQrPerVariantSettings((prev) => {
      const current = prev[key] ?? { included: true, childTags: false };
      return { ...prev, [key]: { ...current, included: !current.included } };
    });
  };

  const toggleVariantChildTags = (key) => {
    setQrPerVariantSettings((prev) => {
      const current = prev[key] ?? { included: true, childTags: false };
      return { ...prev, [key]: { ...current, childTags: !current.childTags } };
    });
  };

  // The one Loose pieces switch applied to every variant — what the queue, preview and payload read.
  const effectiveQrSettings = useMemo(
    () =>
      Object.fromEntries(
        selectedVariants.map((variant) => {
          const key = getVariantKey(variant);
          return [key, { included: true, childTags: false, ...qrPerVariantSettings[key], tagLoosePieces: tagLoose }];
        }),
      ),
    [selectedVariants, qrPerVariantSettings, tagLoose],
  );

  const queryClient = useQueryClient();
  const { mutateAsync: registerStockIn, isPending } = useStockInRegisterApi();

  const handleAddVariant = (variant) => {
    const key = getVariantKey(variant);
    setSelectedVariants((prev) => (prev.some((item) => getVariantKey(item) === key) ? prev : [...prev, variant]));
    ensureConfig(variant);
    // The design already records who makes it, so entering a design fills the jobber in.
    if (variant.jobberName) setJobber({ id: variant.jobberId ?? null, name: variant.jobberName });
  };

  const omitKey = (record, key) =>
    Object.fromEntries(Object.entries(record).filter(([recordKey]) => recordKey !== key));

  const handleRemoveVariant = (variant) => {
    const key = getVariantKey(variant);
    setSelectedVariants((prev) => prev.filter((item) => getVariantKey(item) !== key));
    setVariantTotals((prev) => omitKey(prev, key));
    setQcOverridesByKey((prev) => omitKey(prev, key));
    setQrPerVariantSettings((prev) => omitKey(prev, key));
  };

  const resetAll = () => {
    setSelectedVariants([]);
    resetConfigs();
    setVariantTotals({});
    setQcOverridesByKey({});
    setJobber({ id: null, name: "" });
    setChallanNo("");
    setIssuedChallanNo("");
    setChallanDate(todayAsIsoDate());
    setTriedSteps({});
    setDefectAction("seconds");
    setQcRemarks("");
    setTagParentChild(true);
    setTagLoose(true);
    setQrPerVariantSettings({});
    setPrintMode("printer");
    setPrintConfig({ engine: "a4", a4Preset: "40", a4StartAt: 1 });
  };

  // Which steps the user has already tried to leave with a problem — inline errors only show
  // after that, so a fresh form isn't covered in red.
  const [triedSteps, setTriedSteps] = useState({});

  const getStepErrors = (step) => {
    const errors = {};
    if (step === 0) {
      if (!jobber?.name?.trim()) errors.jobber = "Select the jobber.";
      if (selectedVariants.length === 0) errors.design = "Add at least one design.";
      if (!challanNo.trim()) errors.challanNo = "Enter the jobber delivery challan no.";
      if (!issuedChallanNo.trim()) errors.issuedChallanNo = "Enter the issued challan number.";
      if (!challanDate) errors.challanDate = "Pick the inward date.";
      else if (challanDate > todayAsIsoDate()) errors.challanDate = "Inward date can't be in the future.";
    }
    if (step === 1) {
      const totalGarments = Object.values(variantTotals).reduce((sum, item) => sum + item.garmentsTotal, 0);
      if (totalGarments === 0) errors.matrix = "Enter at least one full set, semi set or loose piece before continuing.";
    }
    if (step === 2) {
      for (const variant of selectedVariants) {
        const key = getVariantKey(variant);
        const qc = qcByKey[key];
        if (qc && qc.defects > 0 && qc.category === NO_DEFECT_CATEGORY) {
          errors[key] = `Pick a defect category for ${variant.designCode ? `${variant.designCode} · ` : ""}${variant.colorName}.`;
        }
      }
    }
    return errors;
  };

  const canAdvance = (step) => {
    const first = Object.values(getStepErrors(step))[0];
    if (!first) return true;
    setTriedSteps((prev) => ({ ...prev, [step]: true }));
    toast.error(first);
    return false;
  };

  const wizard = useStockInWizard(canAdvance);

  // --- Server-side draft (create on first save, update after) ---
  // draftIdRef is what saves/confirm read (always current inside async callbacks);
  // hydratedDraftId is the draft this wizard's state currently reflects, for rendering.
  const draftIdRef = useRef(null);
  const saveChainRef = useRef(Promise.resolve());
  const [hydratedDraftId, setHydratedDraftId] = useState(null);
  // Set once the inward is registered: the server deleted the draft, so stop fetching it (a
  // window-focus refetch would 404 and bounce the user off the confirmed-print sheet).
  const [consumedDraftId, setConsumedDraftId] = useState(null);
  const draftQuery = useStockInDraftApi(routeDraftId && routeDraftId !== consumedDraftId ? routeDraftId : null);
  const { mutateAsync: saveDraft, isPending: isSavingDraft } = useSaveStockInDraftApi();

  useEffect(() => {
    if (routeDraftId && draftQuery.isError && draftQuery.error?.status === 404) {
      toast.info("That saved draft no longer exists. Returning to Stock In.");
      navigate("/stock-in", { replace: true });
    }
  }, [routeDraftId, draftQuery.isError, draftQuery.error, navigate]);

  // Resume: copy the saved wizard state in once per draft — adjusted during render (not in an
  // effect) so the steps never flash empty before the draft's own state appears.
  const loadedDraft = draftQuery.data?.data;
  if (routeDraftId && loadedDraft && String(loadedDraft.id) === routeDraftId && hydratedDraftId !== routeDraftId) {
    const saved = loadedDraft.state ?? {};
    setHydratedDraftId(routeDraftId);
    setJobber(saved.jobber ?? { id: null, name: "" });
    setChallanNo(saved.challanNo ?? "");
    setIssuedChallanNo(saved.issuedChallanNo ?? "");
    setChallanDate(saved.challanDate || todayAsIsoDate());
    setSelectedVariants(saved.selectedVariants ?? []);
    hydrateConfigs(saved.configs ?? {});
    setVariantTotals(saved.variantTotals ?? {});
    setQcOverridesByKey(saved.qcOverridesByKey ?? {});
    setDefectAction(saved.defectAction ?? "seconds");
    setQcRemarks(saved.qcRemarks ?? "");
    // Drafts saved before the two tag switches existed carry a single printStrategy.
    setTagParentChild(saved.tagParentChild ?? saved.printStrategy !== "parent");
    setTagLoose(saved.tagLoose ?? true);
    setQrPerVariantSettings(saved.qrPerVariantSettings ?? {});
    if (saved.printer) setPrinter(saved.printer);
    wizard.setActiveStep(loadedDraft.currentStep ?? 0);
  }
  const isHydratingDraft = Boolean(routeDraftId) && hydratedDraftId !== routeDraftId && !draftQuery.isError;

  const buildDraftState = () => ({
    jobber,
    challanNo,
    issuedChallanNo,
    challanDate,
    selectedVariants,
    configs,
    // Persisted so a draft resumed past Step 2 still has its totals — SetMatrixVariantCard only
    // reports them while Step 2 is mounted.
    variantTotals,
    qcOverridesByKey,
    defectAction,
    qcRemarks,
    tagParentChild,
    tagLoose,
    qrPerVariantSettings,
    printer,
  });

  // Saves are chained so a quick double "Next" can never POST two drafts for one inward.
  const persistDraft = (currentStep, { silent }) => {
    const state = buildDraftState();
    const run = saveChainRef.current.then(async () => {
      const existingId = draftIdRef.current ?? (hydratedDraftId ? Number(hydratedDraftId) : null);
      try {
        const result = await saveDraft({ draftId: existingId, currentStep, state });
        const savedId = result?.data?.id;
        if (savedId && !existingId) {
          draftIdRef.current = savedId;
          setHydratedDraftId(String(savedId));
          navigate(`/stock-in/drafts/${savedId}`, { replace: true });
        }
        if (!silent) toast.success("Draft saved — resume it any time from the Stock In dashboard.");
      } catch (error) {
        toast.error(
          silent
            ? `Couldn't autosave this draft: ${error?.message ?? "unknown error"}`
            : (error?.message ?? "Couldn't save draft. Please try again."),
        );
      }
    });
    saveChainRef.current = run;
    return run;
  };

  const finishInward = () => {
    queryClient.invalidateQueries({ queryKey: ["qr-center"] });
    resetAll();
    navigate("/stock-in");
  };

  // Records the labels as printed against the batch, then leaves the wizard.
  const recordPrinted = async (batchId, printItems, message) => {
    try {
      await confirmQrBatchPrintApi(batchId, { stockItemQrIds: printItems.map((item) => item.qrId) });
      toast.success(message);
    } catch (error) {
      toast.warning(`${message} ${error.message} — the labels were sent, but the batch could not be marked printed.`);
    }
    finishInward();
  };

  // Prints the just-registered inward from what the server saved: the batch endpoint gives every
  // tag the chosen switches cover its short code (issuing any still missing) and returns them, so
  // the QR on each label is the code Stock Out, Break Set and QR Center resolve. Returns true when
  // a print is now under way and the caller must not leave the wizard yet.
  const printRegisteredTags = async (registration, registeredMessage) => {
    const batchId = registration?.challan?.id ? `c${registration.challan.id}` : null;
    const includedVariantIds = new Set(
      Object.entries(configs)
        .filter(([key]) => effectiveQrSettings[key]?.included !== false)
        .map(([, config]) => config.colorVariantId),
    );
    const transactionIds = (registration?.variants ?? [])
      .filter((variant) => includedVariantIds.has(variant.colorVariantId))
      .map((variant) => variant.stockInTransactionId);

    if (!batchId || transactionIds.length === 0 || (!tagParentChild && !tagLoose)) return false;

    let issued;
    try {
      issued = (await issueQrBatchApi(batchId, { parentChild: tagParentChild, loose: tagLoose, transactionIds, reprint: false })).data;
    } catch (error) {
      toast.warning(`${registeredMessage} The labels couldn't be prepared (${error.message}) — print them from QR Center.`);
      finishInward();
      return true;
    }

    const printItems = issued.printItems;
    const summary = `${registeredMessage} ${printItems.length} QR label${printItems.length === 1 ? "" : "s"}`;
    const included = Object.fromEntries(issued.variants.map((variant) => [variant.transactionId, transactionIds.includes(variant.transactionId)]));
    const tags = queuedEntries(issued.variants, { tagParentChild, tagLoose, included, reprint: false }).map(({ variant, tag }) =>
      toDisplayTag(variant, tag, { ...printConfig, fieldsOnCount: () => 0 }),
    );
    const sheet = {
      engine: printConfig.engine,
      a4Preset: printConfig.a4Preset,
      a4StartAt: printConfig.a4StartAt,
      thermalPreset: printConfig.thermalPreset,
      fields: printConfig.fields,
      qrmm: printConfig.qrmm,
      typography: printConfig.typography,
    };

    if (printMode === "pdf") {
      setSheetJob({ mode: "pdf", tags, sheet, message: `${summary} saved as PDF — they stay unprinted in QR Center until sent to a printer.` });
      return true;
    }

    if (printConfig.engine === "thermal") {
      setSheetJob({ mode: "print", tags, sheet, batchId, printItems, message: `${summary} sent to the printer.` });
      return true;
    }

    // The local print agent can't import this app's code, so it gets the finished label lines.
    const items = printItems.map((item) => ({ ...item, labelLines: buildConfirmedLabelLines(item, printConfig) }));
    try {
      const printResult = await submitA4QrPrintJob({ items, startAt: printConfig.a4StartAt, content: printConfig });
      const sheetCount = Math.ceil((printResult.count + Number(printConfig.a4StartAt || 1) - 1) / 40);
      await recordPrinted(batchId, printItems, `${summary} across ${sheetCount} sheets submitted to ${printResult.printer}.`);
    } catch (error) {
      toast.warning(`${error.message} Opening the browser print dialog as a fallback.`);
      setConfirmedQrPrint({ items, startAt: printConfig.a4StartAt, content: printConfig, batchId, printItems, message: `${summary} sent to the printer.` });
    }
    return true;
  };

  const handleConfirmInward = async () => {
    // Steps can be reached out of order through the stepper, so re-check the data-entry steps.
    for (const step of [0, 1, 2]) {
      const first = Object.values(getStepErrors(step))[0];
      if (first) {
        setTriedSteps((prev) => ({ ...prev, [step]: true }));
        wizard.setActiveStep(step);
        toast.error(first);
        return;
      }
    }

    const payload = buildStockInPayload(selectedVariants, configs, {
      challan: {
        jobberName: jobber.name.trim(),
        challanNo: challanNo.trim(),
        issuedChallanNo: issuedChallanNo.trim(),
        stockDate: challanDate,
        remarks: qcRemarks.trim() || undefined,
        defectAction,
      },
      tagParentChild,
      qrPerVariantSettings: effectiveQrSettings,
      qcByKey,
      printOnConfirm: false,
      printerId,
      serialStarts: printConfig.serialStarts,
    });

    if (payload.designs.length === 0) {
      toast.error("Enter stock for at least one variant before registering.");
      return;
    }

    const totalReceived = Object.values(variantTotals).reduce((sum, item) => sum + item.garmentsTotal, 0);

    try {
      // Let any in-flight autosave finish first so its draft id is known and removed on confirm.
      await saveChainRef.current;
      const draftId = draftIdRef.current ?? (hydratedDraftId ? Number(hydratedDraftId) : null);
      const result = await registerStockIn(draftId ? { ...payload, draftId } : payload);
      const serialLabel = result?.data?.challan?.serialLabel;
      const registeredMessage = `Stock-in ${serialLabel ?? ""} registered · challan ${challanNo.trim()} · ${totalReceived} pcs added.`;
      if (draftId) setConsumedDraftId(String(draftId));
      if (printMode !== "later" && (await printRegisteredTags(result?.data, registeredMessage))) return;
      toast.success(registeredMessage);
      resetAll();
      navigate("/stock-in");
    } catch (error) {
      // If the serial numbers moved under us, the studio refetches them and re-numbers its labels.
      queryClient.invalidateQueries({ queryKey: ["stock-in", "serial-counters"] });
      toast.error(error?.message ?? "Couldn't register stock. Please try again.");
    }
  };

  const handleNext = () => {
    if (wizard.activeStep === 4) {
      handleConfirmInward();
      return;
    }
    const nextStep = wizard.next();
    if (nextStep !== null) persistDraft(nextStep, { silent: true });
  };

  const handleSaveDraft = () => persistDraft(wizard.activeStep, { silent: false });

  // Enter / arrow-key entry on the three data-entry steps.
  const stepsRef = useRef(null);
  const handleAdvanceByKeyboard = useCallback(() => document.getElementById("stock-in-next")?.click(), []);
  useWizardKeyboardNav({ containerRef: stepsRef, enabled: wizard.activeStep <= 2, onAdvance: handleAdvanceByKeyboard });

  // Totals the Summary announces, from the same rows the QR Tag Studio queue uses.
  const tagCounts = useMemo(() => {
    const rows = selectedVariants.map((variant) => {
      const key = getVariantKey(variant);
      const totals = variantTotals[key] ?? { setsTotal: 0, semiSetsTotal: 0, looseTotal: 0 };
      return computeVariantRow(
        { key, setsTotal: totals.setsTotal, semiSetsTotal: totals.semiSetsTotal, looseTotal: totals.looseTotal, qcPassed: qcByKey[key]?.passed ?? 0 },
        printStrategy,
        effectiveQrSettings,
      );
    });
    const aggregate = aggregateRows(rows);
    return { parents: aggregate.parent, children: aggregate.child, loose: aggregate.loose };
  }, [selectedVariants, variantTotals, qcByKey, printStrategy, effectiveQrSettings]);

  const sizeLabelsById = useMemo(
    () => Object.fromEntries(Object.values(variantTotals).flatMap((totals) => (totals.sizes ?? []).map((size) => [String(size.id), size.sizeLabel]))),
    [variantTotals],
  );

  const stepErrors = {
    0: triedSteps[0] ? getStepErrors(0) : {},
    1: triedSteps[1] ? getStepErrors(1) : {},
    2: triedSteps[2] ? getStepErrors(2) : {},
  };

  // Test labels are sample IDs from the studio, not persisted QR payloads. Only confirmed
  // inward jobs are sent to the local agent with their server-generated QR payloads.
  const handleTestPrint = (tagId) => {
    toast.info(`No test label was sent${tagId ? ` (${tagId})` : ""}; use a confirmed inward to print saved QR codes.`);
  };

  const handleConfirmedPrintComplete = () => {
    const job = confirmedQrPrint;
    setConfirmedQrPrint(null);
    recordPrinted(job.batchId, job.printItems, job.message);
  };

  const tagDataForPrint = (tag) => buildBatchTagData(tag, { jobber: jobber.name, date: challanDate });

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col rounded-2xl border border-slate-100 bg-white p-6">
      <div className="mb-6 space-y-5 border-b border-slate-100 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Link
            to="/stock-in"
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="size-3.5" /> <h1 className="text-2xl font-bold text-slate-900">Stock Inwarding</h1>
          </Link>
          <div className="">
            <span
              title="Assigned when the inward is confirmed"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
            >
              Serial No. <b className="font-mono text-[13px] text-slate-900">{nextSerial ?? "…"}</b>
            </span>
          </div>
        </div>

        <StockInStepper activeStep={wizard.activeStep} setActiveStep={wizard.setActiveStep} />
      </div>

      {draftQuery.isError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm text-slate-500">
          <p>{draftQuery.error?.message ?? "Couldn't load this draft."}</p>
          <Link to="/stock-in" className="font-semibold text-emerald-700 hover:text-emerald-800">
            Back to Stock In dashboard
          </Link>
        </div>
      ) : isHydratingDraft ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" /> Loading draft…
        </div>
      ) : (
      <>
      <div className="flex-1" ref={stepsRef}>
        {wizard.activeStep === 0 && (
          <InwardDetailsStep
            jobber={jobber}
            onJobberChange={setJobber}
            challanNo={challanNo}
            onChallanNoChange={setChallanNo}
            issuedChallanNo={issuedChallanNo}
            onIssuedChallanNoChange={setIssuedChallanNo}
            challanDate={challanDate}
            onChallanDateChange={setChallanDate}
            nextSerial={nextSerial}
            selectedVariants={selectedVariants}
            onAddVariant={handleAddVariant}
            onRemoveVariant={handleRemoveVariant}
            errors={stepErrors[0]}
          />
        )}

        {wizard.activeStep === 1 && (
          <SetMatrixStep
            selectedVariants={selectedVariants}
            configs={configs}
            onSetTotalSetsReceived={setTotalSetsReceived}
            onSetLoosePieces={setLoosePieces}
            onAddBundle={addBundle}
            onUpdateBundle={updateBundle}
            onRemoveBundle={removeBundle}
            variantTotals={variantTotals}
            onVariantTotalsChange={handleVariantTotalsChange}
            error={stepErrors[1].matrix}
          />
        )}

        {wizard.activeStep === 2 && (
          <QcDefectStep
            selectedVariants={selectedVariants}
            variantTotals={variantTotals}
            qcByKey={qcByKey}
            onQcFieldChange={handleQcFieldChange}
            defectAction={defectAction}
            onDefectActionChange={setDefectAction}
            qcRemarks={qcRemarks}
            onQcRemarksChange={setQcRemarks}
            errors={stepErrors[2]}
          />
        )}

        {wizard.activeStep === 3 && (
          <QrTagStudioStep
            selectedVariants={selectedVariants}
            variantTotals={variantTotals}
            configs={configs}
            qcByKey={qcByKey}
            jobber={jobber}
            challanNo={challanNo}
            challanDate={challanDate}
            defectAction={defectAction}
            printStrategy={printStrategy}
            tagParentChild={tagParentChild}
            tagLoose={tagLoose}
            onToggleParentChild={() => setTagParentChild((on) => !on)}
            onToggleLoose={() => setTagLoose((on) => !on)}
            perVariantSettings={effectiveQrSettings}
            onToggleVariantIncluded={toggleVariantIncluded}
            onToggleVariantChildTags={toggleVariantChildTags}
            printer={printer}
            printerId={printerId}
            onPrinterChange={setPrinter}
            onTestPrint={handleTestPrint}
            onPrintConfigChange={setPrintConfig}
            printMode={printMode}
            onPrintModeChange={setPrintMode}
          />
        )}

        {wizard.activeStep === 4 && (
          <SummaryStep
            selectedVariants={selectedVariants}
            variantTotals={variantTotals}
            qcByKey={qcByKey}
            configs={configs}
            sizeLabelsById={sizeLabelsById}
            defectAction={defectAction}
            challanNo={challanNo}
            issuedChallanNo={issuedChallanNo}
            nextSerial={nextSerial}
            tagCounts={tagCounts}
          />
        )}
      </div>

      <StockInWizardNavigation
        activeStep={wizard.activeStep}
        onPrev={wizard.prev}
        onNext={handleNext}
        onSaveDraft={handleSaveDraft}
        isSubmitting={isPending}
        isSavingDraft={isSavingDraft}
      />
      </>
      )}
      {confirmedQrPrint && (
        <ConfirmedA4QrPrintSheet
          items={confirmedQrPrint.items}
          startAt={confirmedQrPrint.startAt}
          content={confirmedQrPrint.content}
          onAfterPrint={handleConfirmedPrintComplete}
        />
      )}
      {sheetJob && (
        <SheetJob
          job={sheetJob}
          sheet={sheetJob.sheet}
          buildTagData={tagDataForPrint}
          fileName={`qr-tags-${challanNo.trim() || "stock-in"}.pdf`}
          onPrinted={() => {
            const job = sheetJob;
            setSheetJob(null);
            recordPrinted(job.batchId, job.printItems, job.message);
          }}
          onDone={() => {
            toast.success(sheetJob.message);
            setSheetJob(null);
            finishInward();
          }}
          onError={(error) => {
            toast.error(`${error?.message ?? "Couldn't create the PDF."} The inward is registered — print its labels from QR Center.`);
            setSheetJob(null);
            finishInward();
          }}
        />
      )}
    </div>
  );
};

export default StockIn;
