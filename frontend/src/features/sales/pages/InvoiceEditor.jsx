import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "react-toastify";
import { AlertTriangle, ArrowLeft, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ActionModal from "@/components/shared/ActionModal";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { checkInvoiceNumberApi, checkScanApi, suggestInvoiceNumberApi } from "../services/invoice.api.js";
import { getOrderFormApi, getOrderFormByNumberApi } from "../services/orderForm.api.js";
import { useInvoiceApi, useSaveInvoiceApi } from "../hooks/useInvoicesApi.js";
import { useOrderFormsApi } from "../hooks/useOrderFormsApi.js";
import { useTagFinder } from "../hooks/useTagFinder.jsx";
import DocumentNumberField from "../components/DocumentNumberField.jsx";
import PartyPicker, { EMPTY_PARTY_FIELDS } from "../components/PartyPicker.jsx";
import PartySyncDialog from "../components/PartySyncDialog.jsx";
import ScanPanel from "../components/ScanPanel.jsx";
import { KindChip } from "../components/TagFinderResult.jsx";
import { KIND } from "../utils/tagKinds.js";
import { inr, longDate, todayIso } from "../utils/format.js";

const variantName = (item) => `${item.designCode} ${item.colorName}`;

const InvoiceEditor = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isEditing = Boolean(id);

    const { data: existingResponse, isPending: loadingExisting } = useInvoiceApi(id);
    const existing = existingResponse?.data;

    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [invoiceDate, setInvoiceDate] = useState(todayIso());
    const [orderForm, setOrderForm] = useState(null);
    const [orderFormQuery, setOrderFormQuery] = useState("");
    const [orderFormError, setOrderFormError] = useState("");
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);
    const [party, setParty] = useState(EMPTY_PARTY_FIELDS);
    const [linkedParty, setLinkedParty] = useState(null);
    const [picked, setPicked] = useState([]);
    const [ticks, setTicks] = useState({});
    const [feedback, setFeedback] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [syncPrompt, setSyncPrompt] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [switchTo, setSwitchTo] = useState(null);

    const scanRef = useRef(null);
    const suggestionsTimer = useRef(null);

    const saveInvoice = useSaveInvoiceApi();

    // Open order forms matching what is typed in the "fetch" box, offered as you type.
    const debouncedOrderQuery = useDebouncedValue(orderFormQuery.trim(), 200);
    const { data: suggestionResponse } = useOrderFormsApi({ q: debouncedOrderQuery, status: "OPEN", limit: 6 });
    const suggestions = suggestionResponse?.data ?? [];

    // Arriving from an order form's "Create Invoice" button.
    useEffect(() => {
        const orderFormId = searchParams.get("orderFormId");
        if (!orderFormId || isEditing) return;

        getOrderFormApi(orderFormId)
            .then((response) => loadOrderForm(response.data))
            .catch((error) => setOrderFormError(error.message));
    }, [searchParams, isEditing]);

    useEffect(() => {
        if (!existing) return;

        setInvoiceNumber(existing.invoiceNumber);
        setInvoiceDate(existing.invoiceDate);
        setParty(existing.party);
        setLinkedParty(existing.partyId ? { id: existing.partyId, ...existing.party } : null);
        setTicks(existing.ticks ?? {});
        setPicked(existing.lines.flatMap((line) => line.tags.map((tag) => ({
            scanCode: tag.scanCode,
            kind: tag.kind,
            pieces: tag.pieces,
            method: tag.method,
            designCode: line.designCode,
            designName: line.designName,
            colorName: line.colorName,
            colorHex: line.colorHex,
            colorVariantId: line.colorVariantId,
            unitPrice: line.unitPrice,
            sizeBreakdown: tag.sizeBreakdown,
        }))));

        getOrderFormApi(existing.orderFormId)
            .then((response) => { setOrderForm(response.data); setOrderFormQuery(response.data.formNumber); })
            .catch(() => {});
    }, [existing]);

    function loadOrderForm(form) {
        setOrderForm(form);
        setOrderFormQuery(form.formNumber);
        setOrderFormError("");
        setParty(form.party);
        setLinkedParty(form.partyId ? { id: form.partyId, ...form.party } : null);
    }

    const fetchOrderForm = async (number = orderFormQuery) => {
        const wanted = number.trim();
        if (!wanted) return setOrderFormError("Enter an order form number first.");

        setSuggestionsOpen(false);

        try {
            const response = await getOrderFormByNumberApi(wanted);
            const form = response.data;

            if (form.status === "INVOICED") {
                setOrderFormError(`${form.formNumber} is already invoiced as ${form.invoice?.invoiceNumber ?? "another invoice"}.`);
                return;
            }

            // Scans made against another order form stay; only the checklist and party change.
            if (picked.length > 0 && orderForm && orderForm.id !== form.id) {
                setSwitchTo(form);
                return;
            }

            loadOrderForm(form);
        } catch (error) {
            setOrderFormError(error.message);
        }
    };

    // Adds a tag the server has already confirmed can be billed.
    const addTag = (result, method = "Manual") => {
        setPicked((previous) => [...previous, {
            scanCode: result.shortCode,
            kind: result.kind,
            pieces: result.pieces,
            method,
            designCode: result.designCode,
            designName: result.designName,
            colorName: result.colorName,
            colorHex: result.colorHex,
            colorVariantId: result.colorVariantId,
            unitPrice: result.unitPrice,
            sizeBreakdown: result.sizeBreakdown,
        }]);

        const onOrderForm = orderForm?.items.some((item) => item.colorVariantId === result.colorVariantId);
        const sizes = result.sizeBreakdown.map((size) => size.sizeLabel).join(" · ");

        setFeedback({
            tone: onOrderForm ? "ok" : "warn",
            message: (
                <>
                    <b>+{result.pieces} pc{result.pieces > 1 ? "s" : ""}</b> · {KIND[result.kind]?.full} {result.shortCode} ({sizes}) added to{" "}
                    <b>{result.designCode} {result.colorName}</b>{onOrderForm ? "." : <> — <b>not on the order form</b>, added as an extra.</>}
                </>
            ),
        });
    };

    // Camera, QR gun and the Enter key on text that matched nothing: ask the server what the code
    // is, say why it can't be billed, or add it.
    const handleScan = async (code, method) => {
        setScanning(true);

        try {
            const response = await checkScanApi({
                code,
                scanned: picked.map((item) => item.scanCode),
                invoiceId: existing?.id,
            });
            const result = response.data;

            if (result.state === "UNKNOWN") {
                setFeedback({ tone: "bad", message: <><b>{code}</b> isn&rsquo;t a known QR tag.</> });
                return;
            }
            if (result.state === "RETIRED") {
                setFeedback({ tone: "bad", message: <><b>{code}</b> is a retired label — its stock was broken up or relabelled. Scan the current tag.</> });
                return;
            }
            if (result.state === "DUPLICATE") {
                setFeedback({ tone: "bad", message: <><b>{code}</b> is printed on two different items. Fix it in QR Center before billing either.</> });
                return;
            }
            if (result.state === "ALREADY_SCANNED") {
                setFeedback({ tone: "warn", message: <><b>{code}</b> is already on this invoice.</> });
                return;
            }
            if (result.state === "UNAVAILABLE") {
                setFeedback({
                    tone: "bad",
                    message: result.billedOn
                        ? <><b>{code}</b> was already sold on {result.billedOn}.</>
                        : <><b>{code}</b> is no longer in the sellable pool.</>,
                });
                return;
            }

            addTag(result, method);
        } catch (error) {
            setFeedback({ tone: "bad", message: error.message });
        } finally {
            setScanning(false);
        }
    };

    const lines = useMemo(() => {
        const byVariant = new Map();

        for (const item of picked) {
            const existingLine = byVariant.get(item.colorVariantId) ?? {
                colorVariantId: item.colorVariantId,
                designCode: item.designCode,
                designName: item.designName,
                colorName: item.colorName,
                colorHex: item.colorHex,
                unitPrice: item.unitPrice,
                pieces: 0,
                tags: [],
            };

            existingLine.pieces += item.pieces;
            existingLine.tags.push(item);
            byVariant.set(item.colorVariantId, existingLine);
        }

        return [...byVariant.values()].map((line) => ({
            ...line,
            amount: line.pieces * line.unitPrice,
            isExtra: orderForm ? !orderForm.items.some((item) => item.colorVariantId === line.colorVariantId) : false,
        }));
    }, [picked, orderForm]);

    const totals = useMemo(() => ({
        pieces: lines.reduce((sum, line) => sum + line.pieces, 0),
        amount: lines.reduce((sum, line) => sum + line.amount, 0),
    }), [lines]);

    const pickedFor = (colorVariantId) =>
        picked.filter((item) => item.colorVariantId === colorVariantId).reduce((sum, item) => sum + item.pieces, 0);

    // Tags picked in this sitting. Stock for the ones an edited invoice already holds was taken off
    // when it was saved, so only the new ones still count against what the godown has.
    const savedCodes = useMemo(() => new Set(existing?.lines.flatMap((line) => line.tags.map((tag) => tag.scanCode)) ?? []), [existing]);
    const pickedNowFor = (colorVariantId) =>
        picked.filter((item) => item.colorVariantId === colorVariantId && !savedCodes.has(item.scanCode))
            .reduce((sum, item) => sum + item.pieces, 0);

    const finder = useTagFinder({
        picked,
        invoiceId: existing?.id,
        orderForm,
        pickedFor,
        onAdd: (result) => addTag(result, "Manual"),
        onRaw: (text) => handleScan(text, "Manual"),
        scanRef,
    });

    const save = async (partySync) => {
        try {
            const result = await saveInvoice.mutateAsync({
                id: existing?.id,
                payload: {
                    invoiceNumber: invoiceNumber.trim(),
                    invoiceDate,
                    orderFormId: orderForm.id,
                    partyId: linkedParty?.id ?? null,
                    party,
                    partySync,
                    ticks,
                    scans: picked.map((item) => ({ scanCode: item.scanCode, method: item.method })),
                },
            });

            toast.success(result.message);
            navigate(`/stock-out/invoices/${result.data.id}`);
        } catch (error) {
            toast.error(error.message);
        }
    };

    const submit = () => {
        if (!invoiceNumber.trim()) return toast.error("Enter the invoice number.");
        if (!orderForm) return toast.error("Fetch an order form first.");
        if (picked.length === 0) return toast.error("Scan at least one set or piece.");

        const short = orderForm.items.filter((item) => pickedFor(item.colorVariantId) < item.quantityPcs);
        const unticked = orderForm.items.filter((item) => !ticks[item.colorVariantId]);
        const extras = lines.filter((line) => line.isExtra);

        setConfirm({ short, unticked, extras });
    };

    const confirmed = () => {
        setConfirm(null);

        const changed = linkedParty
            ? ["name", "mobile", "city", "gst", "transport", "agent"].filter((field) => (linkedParty[field] ?? "") !== (party[field] ?? ""))
            : [];

        if (changed.length > 0) {
            setSyncPrompt({ changed, linkedParty, party });
            return;
        }

        save("document");
    };

    if (isEditing && loadingExisting) {
        return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-[#00694C]" /></div>;
    }

    const tickedCount = orderForm ? orderForm.items.filter((item) => ticks[item.colorVariantId]).length : 0;

    return (
        <div className="flex flex-col gap-4 pb-4">
            <div className="glass-card rounded-[24px] p-5">
                <div className="space-y-5">
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => navigate(isEditing ? `/stock-out/invoices/${existing?.id ?? ""}` : "/stock-out/invoices")}
                            className="mb-1 flex items-center gap-1 text-xs font-semibold text-[#1E1B4B]/60 hover:text-[#1E1B4B]"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-[#1E1B4B]">
                                {isEditing ? "Edit Invoice" : "New Invoice"}
                            </h1>
                            <p className="mt-0.5 max-w-[72ch] text-xs text-[#1E1B4B]/55">
                                Fetch the order form as your checklist, then scan every set, semi set or piece you pick. Stock is deducted only when you generate the invoice.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-start gap-4">
                        <DocumentNumberField
                            label="Invoice no."
                            value={invoiceNumber}
                            onChange={setInvoiceNumber}
                            placeholder="e.g. INV-2026-042"
                            check={checkInvoiceNumberApi}
                            suggest={suggestInvoiceNumberApi}
                            excludeId={existing?.id}
                        />
                        <div className="w-40">
                            <label className="mb-1.5 block text-xs font-semibold text-[#1E1B4B]" htmlFor="invoice-date">Date</label>
                            <input
                                id="invoice-date"
                                type="date"
                                className="pill-input font-mono"
                                value={invoiceDate}
                                onChange={(event) => setInvoiceDate(event.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="relative mt-4 max-w-[520px]">
                    <label className="mb-1.5 block text-xs font-semibold text-[#1E1B4B]" htmlFor="order-form-number">
                        Order form no. <span className="text-red-600">*</span>
                    </label>
                    <div className="flex gap-2">
                        <input
                            id="order-form-number"
                            className="pill-input font-mono"
                            autoComplete="off"
                            value={orderFormQuery}
                            disabled={isEditing}
                            onChange={(event) => { setOrderFormQuery(event.target.value); setSuggestionsOpen(true); }}
                            onFocus={() => { clearTimeout(suggestionsTimer.current); setSuggestionsOpen(true); }}
                            onBlur={() => { suggestionsTimer.current = setTimeout(() => setSuggestionsOpen(false), 120); }}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") { event.preventDefault(); fetchOrderForm(); }
                                else if (event.key === "Escape") setSuggestionsOpen(false);
                            }}
                            placeholder="Type the order form number to fetch it"
                        />
                        <button
                            type="button"
                            onClick={() => fetchOrderForm()}
                            disabled={isEditing}
                            className="shrink-0 rounded-lg bg-[#1E1B4B] px-4 text-xs font-semibold text-white disabled:opacity-50"
                        >
                            Fetch
                        </button>
                    </div>

                    {suggestionsOpen && !isEditing && suggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-[calc(100%-18px)] z-30 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                            {suggestions.map((form) => (
                                <button
                                    key={form.id}
                                    type="button"
                                    className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3.5 py-2.5 text-left last:border-b-0 hover:bg-emerald-50"
                                    onMouseDown={(event) => { event.preventDefault(); setOrderFormQuery(form.formNumber); fetchOrderForm(form.formNumber); }}
                                >
                                    <span>
                                        <span className="block font-mono text-sm font-semibold text-[#1E1B4B]">{form.formNumber}</span>
                                        <span className="block text-xs text-slate-500">{form.party.name} · {form.totalPcs} pcs</span>
                                    </span>
                                    <span className="text-xs text-slate-400">{longDate(form.formDate)}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    <p className={`mt-1.5 min-h-[18px] text-[11.5px] ${orderFormError ? "text-red-600" : "text-emerald-700"}`}>
                        {orderFormError || (orderForm
                            ? `Fetched ${orderForm.formNumber} · ${orderForm.party.name}${orderForm.salesman ? ` · Salesman ${orderForm.salesman}` : ""} · ${orderForm.totalPcs} pcs requested`
                            : "")}
                    </p>
                </div>
            </div>

            {!orderForm ? (
                <div className="glass-card flex flex-col items-center justify-center gap-2 rounded-[24px] p-10 text-center">
                    <b className="text-[#1E1B4B]">Fetch an order form to begin</b>
                    <span className="max-w-[52ch] text-sm text-[#1E1B4B]/55">
                        The order form becomes your picking checklist — you can still add designs that aren&rsquo;t on it.
                    </span>
                </div>
            ) : (
                <>
                    <div className="glass-card rounded-[24px] p-5">
                        <PartyPicker value={party} onChange={setParty} linkedParty={linkedParty} onLink={setLinkedParty} />
                    </div>

                    <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1.1fr_1fr] 2xl:items-start">
                        <div className="glass-card rounded-[24px] p-5">
                            <div className="mb-3 flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-base font-bold text-[#1E1B4B]">Checklist · {orderForm.formNumber}</h2>
                                    <p className="text-xs text-[#1E1B4B]/60">
                                        Tick each line as you find it in the godown. Demand vs available updates as you scan.
                                    </p>
                                </div>
                                <span className="shrink-0 text-xs text-[#1E1B4B]/55"><b>{tickedCount}</b> of {orderForm.items.length} ticked</span>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-white/60">
                                <div className="grid grid-cols-[28px_minmax(0,1.7fr)_44px_56px_44px_minmax(0,1.2fr)] items-center gap-2 border-b border-white/60 bg-white/40 px-3 py-2 text-[9.8px] font-bold uppercase tracking-wider text-[#1E1B4B]/45">
                                    <span />
                                    <span>Design · variant</span>
                                    <span className="text-right">Demand</span>
                                    <span className="text-right">Available</span>
                                    <span className="text-right">Picked</span>
                                    <span>Status</span>
                                </div>

                                {orderForm.items.map((item) => {
                                    const got = pickedFor(item.colorVariantId);
                                    const ticked = Boolean(ticks[item.colorVariantId]);
                                    const available = Math.max(0, (item.availablePcs ?? 0) - pickedNowFor(item.colorVariantId));
                                    const need = item.quantityPcs - got;

                                    let status;
                                    if (got >= item.quantityPcs) {
                                        status = <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700">{got > item.quantityPcs ? `Picked ${got - item.quantityPcs} extra` : "Complete"}</span>;
                                    } else if (available < need) {
                                        status = <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10.5px] font-semibold text-red-700">{available === 0 && got === 0 ? "Out of stock" : `Stock short by ${need - available}`}</span>;
                                    } else {
                                        status = <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700">{need} more to pick</span>;
                                    }

                                    return (
                                        <div
                                            key={item.colorVariantId}
                                            className={`grid grid-cols-[28px_minmax(0,1.7fr)_44px_56px_44px_minmax(0,1.2fr)] items-center gap-2 border-b border-white/60 px-3 py-2 text-sm last:border-b-0 ${ticked ? "bg-emerald-50/70" : "bg-white/40"}`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => setTicks((previous) => ({ ...previous, [item.colorVariantId]: !previous[item.colorVariantId] }))}
                                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                                    ticked ? "border-emerald-600 bg-emerald-600 text-white" : "border-[#1E1B4B]/20 bg-white"
                                                }`}
                                                aria-label={`Tick ${variantName(item)}`}
                                            >
                                                {ticked && <Check className="h-3 w-3" />}
                                            </button>

                                            <div className="flex min-w-0 items-center gap-2">
                                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.colorHex }} />
                                                <span className="truncate font-semibold text-[#1E1B4B]">
                                                    {item.designCode} <span className="font-normal">{item.colorName}</span>
                                                </span>
                                            </div>

                                            <span className="text-right font-mono text-xs text-[#1E1B4B]/70">{item.quantityPcs}</span>
                                            <span className="text-right font-mono text-xs text-[#1E1B4B]/60">{available}</span>
                                            <span className={`text-right font-mono text-sm font-bold ${got ? "text-[#1E1B4B]" : "text-[#1E1B4B]/30"}`}>{got}</span>
                                            <span>{status}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="glass-card rounded-[24px] p-5">
                            <ScanPanel
                                ref={scanRef}
                                title="Scan picked stock"
                                hint="Parent = whole set, semi-set QR = its pieces, child or loose = 1 piece. Counted automatically."
                                placeholder="Set ID or piece ID, e.g. SET-KP100-MID-003"
                                manualLabel="Type Set ID"
                                live={finder}
                                onScan={handleScan}
                                feedback={feedback}
                                busy={scanning}
                            />
                        </div>
                    </div>

                    <div className="glass-card rounded-[24px] p-5">
                        <div className="mb-3">
                            <h2 className="text-base font-bold text-[#1E1B4B]">Picked for this invoice</h2>
                            <p className="text-xs text-[#1E1B4B]/60">
                                Every scanned tag, grouped by design and variant. Remove a tag if it was scanned by mistake.
                            </p>
                        </div>

                        {lines.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-[#1E1B4B]/15 p-8 text-center">
                                <b className="block text-sm text-[#1E1B4B]">Nothing picked yet</b>
                                <span className="text-sm text-[#1E1B4B]/55">Scan the first set or piece you pick from the godown.</span>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {lines.map((line) => (
                                    <div key={line.colorVariantId} className="overflow-hidden rounded-2xl border border-white/60">
                                        <div className="flex items-center justify-between gap-3 bg-white/70 px-4 py-2.5">
                                            <div className="flex items-center gap-2.5">
                                                <span className="h-2.5 w-2.5 rounded-full" style={{ background: line.colorHex }} />
                                                <b className="text-sm text-[#1E1B4B]">{line.designCode} · {line.colorName}</b>
                                                {line.isExtra && (
                                                    <span className="rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                                                        NOT ON ORDER FORM
                                                    </span>
                                                )}
                                            </div>
                                            <span className="font-mono text-sm font-bold text-[#1E1B4B]">{line.pieces} pcs · {inr(line.amount)}</span>
                                        </div>

                                        {line.tags.map((tag) => (
                                            <div key={tag.scanCode} className="flex flex-wrap items-center gap-3 border-t border-white/60 bg-white/40 px-4 py-2 text-xs">
                                                <span className="font-mono font-semibold text-[#1E1B4B]">{tag.scanCode}</span>
                                                <KindChip kind={tag.kind} />
                                                <span className="font-mono text-[11px] text-[#1E1B4B]/50">
                                                    {tag.sizeBreakdown.map((size) => size.sizeLabel).join(" ")}
                                                </span>
                                                <span className="ml-auto font-mono text-[#1E1B4B]/70">{tag.pieces} pc{tag.pieces > 1 ? "s" : ""}</span>
                                                <span className="text-[11px] text-[#1E1B4B]/40">{tag.method}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setPicked((previous) => previous.filter((item) => item.scanCode !== tag.scanCode));
                                                        setFeedback({ tone: "warn", message: <>Removed <b>{tag.scanCode}</b> from this invoice.</> });
                                                    }}
                                                    className="rounded p-1 text-[#1E1B4B]/35 hover:bg-red-50 hover:text-red-600"
                                                    title="Remove"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="glass-card flex flex-wrap items-center justify-between gap-4 rounded-[24px] p-5">
                        <div className="flex flex-wrap gap-6">
                            {[
                                { label: "Variants", value: lines.length },
                                { label: "Tags scanned", value: picked.length },
                                { label: "Pieces", value: totals.pieces },
                                { label: "Invoice value", value: inr(totals.amount), accent: true },
                            ].map((stat) => (
                                <div key={stat.label}>
                                    <div className={`font-mono text-lg font-bold ${stat.accent ? "text-[#00694C]" : "text-[#1E1B4B]"}`}>{stat.value}</div>
                                    <div className="text-[10.5px] uppercase tracking-wide text-[#1E1B4B]/45">{stat.label}</div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => navigate(isEditing ? `/stock-out/invoices/${existing?.id ?? ""}` : "/stock-out/invoices")}>Cancel</Button>
                            <Button
                                className="rounded-full bg-[#00694C] px-6 text-white hover:bg-[#00563e]"
                                onClick={submit}
                                disabled={saveInvoice.isPending}
                            >
                                <Check className="mr-1.5 h-4 w-4" />
                                {isEditing ? "Save invoice changes" : "Generate Invoice"}
                            </Button>
                        </div>
                    </div>
                </>
            )}

            {switchTo && (
                <ActionModal
                    openActionModal
                    setOpenActionModal={() => setSwitchTo(null)}
                    title="Switch order form?"
                    subtitle={`You've already scanned ${picked.reduce((sum, item) => sum + item.pieces, 0)} pcs for ${orderForm?.formNumber}.`}
                    showCloseButton
                >
                    <div className="px-6 py-4 text-sm text-[#1E1B4B]/75">
                        <p>Switching keeps those scans but changes the checklist and party to <b>{switchTo.formNumber}</b>.</p>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-white/40 px-6 py-4">
                        <Button variant="ghost" onClick={() => setSwitchTo(null)}>Cancel</Button>
                        <Button
                            className="rounded-full bg-[#00694C] px-5 text-white hover:bg-[#00563e]"
                            onClick={() => { loadOrderForm(switchTo); setSwitchTo(null); }}
                        >
                            Switch
                        </Button>
                    </div>
                </ActionModal>
            )}

            {confirm && (
                <ActionModal
                    openActionModal
                    setOpenActionModal={() => setConfirm(null)}
                    title={isEditing ? `Save changes to ${invoiceNumber}?` : `Generate invoice ${invoiceNumber}?`}
                    subtitle={`${totals.pieces} pieces across ${lines.length} variant${lines.length === 1 ? "" : "s"} · ${inr(totals.amount)} for ${party.name}`}
                    showCloseButton
                >
                    <div className="px-6 py-4 text-sm text-[#1E1B4B]/75">
                        <p>{isEditing ? "Stock will be adjusted to match the updated invoice." : "These pieces will be deducted from stock."}</p>

                        {(confirm.short.length > 0 || confirm.unticked.length > 0 || confirm.extras.length > 0) && (
                            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-800">
                                {confirm.short.length > 0 && (
                                    <li>
                                        <b>{confirm.short.length}</b> order line{confirm.short.length === 1 ? " is" : "s are"} not fully picked ({confirm.short.map(variantName).join(", ")}).
                                    </li>
                                )}
                                {confirm.unticked.length > 0 && (
                                    <li><b>{confirm.unticked.length}</b> checklist line{confirm.unticked.length === 1 ? " isn't" : "s aren't"} ticked.</li>
                                )}
                                {confirm.extras.length > 0 && (
                                    <li><AlertTriangle className="mr-1 inline h-3 w-3" /><b>{confirm.extras.length}</b> variant{confirm.extras.length === 1 ? "" : "s"} not on the order form will be billed as extras.</li>
                                )}
                            </ul>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 border-t border-white/40 px-6 py-4">
                        <Button variant="ghost" onClick={() => setConfirm(null)}>Back to picking</Button>
                        <Button className="rounded-full bg-[#00694C] px-5 text-white hover:bg-[#00563e]" onClick={confirmed}>
                            {isEditing ? "Save changes" : "Generate Invoice"}
                        </Button>
                    </div>
                </ActionModal>
            )}

            {syncPrompt && (
                <PartySyncDialog
                    changed={syncPrompt.changed}
                    linkedParty={syncPrompt.linkedParty}
                    party={syncPrompt.party}
                    onClose={() => setSyncPrompt(null)}
                    onChoose={(choice) => { setSyncPrompt(null); save(choice); }}
                />
            )}
        </div>
    );
};

export default InvoiceEditor;
