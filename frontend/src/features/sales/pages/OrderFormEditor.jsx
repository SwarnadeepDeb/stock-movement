import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "react-toastify";
import { ArrowLeft, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkOrderFormNumberApi, suggestOrderFormNumberApi } from "../services/orderForm.api.js";
import { resolveDesignApi } from "../services/sales.api.js";
import { useOrderFormApi, useOrderFormsApi, useSaveOrderFormApi } from "../hooks/useOrderFormsApi.js";
import DocumentNumberField from "../components/DocumentNumberField.jsx";
import PartyPicker, { EMPTY_PARTY_FIELDS } from "../components/PartyPicker.jsx";
import PartySyncDialog from "../components/PartySyncDialog.jsx";
import ScanPanel from "../components/ScanPanel.jsx";
import { VariantPane } from "../components/DesignFinder.jsx";
import { existingFor } from "../utils/orderLines.js";
import { useDesignFinder, useQuantityDrafts } from "../hooks/useDesignFinder.jsx";
import { todayIso } from "../utils/format.js";

const OrderFormEditor = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = Boolean(id);

    const { data: existingResponse, isPending: loadingExisting } = useOrderFormApi(id);
    const existing = existingResponse?.data;

    const [formNumber, setFormNumber] = useState("");
    const [formDate, setFormDate] = useState(todayIso());
    const [salesman, setSalesman] = useState("");
    const [notes, setNotes] = useState("");
    const [party, setParty] = useState(EMPTY_PARTY_FIELDS);
    const [linkedParty, setLinkedParty] = useState(null);
    const [items, setItems] = useState([]);
    const [feedback, setFeedback] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [syncPrompt, setSyncPrompt] = useState(null);
    // A scanned hanging tag opens its design's colours under the scanner, ready for pieces.
    const [scanned, setScanned] = useState(null);

    const scanRef = useRef(null);
    const scanPaneRef = useRef(null);
    const scanDrafts = useQuantityDrafts();

    const saveOrderForm = useSaveOrderFormApi();

    // Names already used on earlier order forms, offered as suggestions so the same person is not
    // typed three different ways.
    const { data: recentForms } = useOrderFormsApi({ limit: 200 });
    const salesmanNames = useMemo(
        () => [...new Set((recentForms?.data ?? []).map((form) => form.salesman).filter(Boolean))].sort(),
        [recentForms],
    );

    useEffect(() => {
        if (!existing) return;

        setFormNumber(existing.formNumber);
        setFormDate(existing.formDate);
        setSalesman(existing.salesman ?? "");
        setNotes(existing.notes ?? "");
        setParty(existing.party);
        setLinkedParty(existing.partyId ? { id: existing.partyId, ...existing.party } : null);
        setItems(existing.items.map((item) => ({
            colorVariantId: item.colorVariantId,
            designId: item.designId,
            designCode: item.designCode,
            designName: item.designName,
            colorName: item.colorName,
            colorHex: item.colorHex,
            quantityPcs: item.quantityPcs,
            availablePcs: item.availablePcs,
        })));
    }, [existing]);

    const totals = useMemo(() => ({
        designs: new Set(items.map((item) => item.designId)).size,
        variants: items.length,
        pieces: items.reduce((sum, item) => sum + item.quantityPcs, 0),
    }), [items]);

    // Puts the typed pieces onto the order: a colour with pieces becomes (or updates) its line, a
    // colour left at zero comes off. Returns what was added so the caller can say so.
    const applyQuantities = (design, quantities) => {
        const entered = design.variants.filter((variant) => (quantities[variant.colorVariantId] ?? 0) > 0);
        const total = entered.reduce((sum, variant) => sum + quantities[variant.colorVariantId], 0);

        setItems((previous) => {
            const next = [...previous];

            for (const variant of design.variants) {
                const quantity = quantities[variant.colorVariantId] ?? 0;
                const at = next.findIndex((line) => line.colorVariantId === variant.colorVariantId);

                if (quantity > 0) {
                    const line = {
                        colorVariantId: variant.colorVariantId,
                        designId: design.designId,
                        designCode: design.designCode,
                        designName: design.designName,
                        colorName: variant.colorName,
                        colorHex: variant.colorHex,
                        quantityPcs: quantity,
                        availablePcs: variant.availablePcs,
                    };

                    if (at >= 0) next[at] = line;
                    else next.push(line);
                } else if (at >= 0) {
                    next.splice(at, 1);
                }
            }

            return next;
        });

        setFeedback(total > 0
            ? {
                tone: "ok",
                message: (
                    <>
                        <b>{design.designCode}</b> · {entered.map((variant) => `${variant.colorName} ${quantities[variant.colorVariantId]}`).join(", ")}
                        {" "}— <b>{total} pcs</b> in the order. Type the next design.
                    </>
                ),
            }
            : { tone: "warn", message: <>No pieces entered for <b>{design.designCode}</b>.</> });
    };

    const finder = useDesignFinder({ lines: items, onCommit: applyQuantities, scanRef });

    // Camera and QR gun hand over a tag ID: resolve it to its design and open that design's
    // colours on the colour the tag belongs to.
    const handleScan = async (code) => {
        setScanning(true);

        try {
            const response = await resolveDesignApi(code);
            const data = response.data;

            if (!data || data.state !== "OK") {
                setFeedback({
                    tone: "bad",
                    message: data?.state === "DUPLICATE"
                        ? `${data.shortCode} is on two different items — fix it in QR Center before using it here.`
                        : data?.state === "RETIRED"
                        ? `${data.shortCode} is a retired label — scan the item's current tag.`
                        : "That isn't a known tag or design code. Check the ID and try again.",
                });
                return;
            }

            setScanned({ design: data.design, focusVariantId: data.colorVariantId });
            setFeedback({
                tone: "ok",
                message: (
                    <>
                        <b>{data.designCode} · {data.design.itemName ?? data.designName}</b> found from the <b>{data.colorName}</b> tag. Enter the pieces below and press <b>Enter</b>.
                    </>
                ),
            });
        } catch (error) {
            setFeedback({ tone: "bad", message: error.message });
        } finally {
            setScanning(false);
        }
    };

    // Focus the scanned colour's quantity as soon as its pane is on screen.
    useEffect(() => {
        if (scanned) scanPaneRef.current?.focusQty(scanned.focusVariantId);
    }, [scanned]);

    const closeScanned = () => {
        setScanned(null);
        scanRef.current?.focus();
    };

    const save = async (partySync) => {
        try {
            const result = await saveOrderForm.mutateAsync({
                id: existing?.id,
                payload: {
                    formNumber: formNumber.trim(),
                    formDate,
                    partyId: linkedParty?.id ?? null,
                    party,
                    partySync,
                    salesman: salesman.replace(/\s+/g, " ").trim(),
                    notes,
                    items: items.map((item) => ({ colorVariantId: item.colorVariantId, quantityPcs: item.quantityPcs })),
                },
            });

            toast.success(`Order form ${result.data.formNumber} saved.`);
            navigate(`/stock-out/orders/${result.data.id}`);
        } catch (error) {
            toast.error(error.message);
        }
    };

    const submit = () => {
        if (!formNumber.trim()) return toast.error("Enter the order form number.");
        if (!party.name.trim()) return toast.error("Enter the party name.");
        if (items.length === 0) return toast.error("Scan at least one design.");

        // If the typed party details differ from the saved record, the user decides whether Party
        // Master should learn the change — the same question the prototype asks.
        const changed = linkedParty
            ? ["name", "mobile", "city", "gst", "transport", "agent"]
                .filter((field) => (linkedParty[field] ?? "") !== (party[field] ?? ""))
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

    return (
        <div className="flex flex-col gap-4 pb-4">
            <div className="glass-card rounded-[24px] p-5">
                <div className="space-y-5">
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => navigate("/stock-out/orders")}
                            className="mb-1 flex items-center gap-1 text-xs font-semibold text-[#1E1B4B]/60 hover:text-[#1E1B4B]"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                        </button>
                        <h1 className="text-2xl font-bold tracking-tight text-[#1E1B4B]">
                            {isEditing ? "Edit Order Form" : "New Order Form"}
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-start gap-4">
                        <DocumentNumberField
                            label="Order form no."
                            value={formNumber}
                            onChange={setFormNumber}
                            placeholder="e.g. OF-1024"
                            check={checkOrderFormNumberApi}
                            suggest={suggestOrderFormNumberApi}
                            excludeId={existing?.id}
                        />
                        <div className="w-40">
                            <label className="mb-1.5 block text-xs font-semibold text-[#1E1B4B]" htmlFor="form-date">Date</label>
                            <input
                                id="form-date"
                                type="date"
                                className="pill-input font-mono"
                                value={formDate}
                                onChange={(event) => setFormDate(event.target.value)}
                            />
                        </div>
                        <div className="w-56">
                            <label className="mb-1.5 block text-xs font-semibold text-[#1E1B4B]" htmlFor="order-salesman">Salesman</label>
                            <input
                                id="order-salesman"
                                className="pill-input"
                                list="order-salesman-names"
                                autoComplete="off"
                                maxLength={60}
                                value={salesman}
                                onChange={(event) => setSalesman(event.target.value)}
                                placeholder="Who took this order"
                            />
                            <datalist id="order-salesman-names">
                                {salesmanNames.map((name) => <option key={name} value={name} />)}
                            </datalist>
                            <p className="mt-1.5 text-[11.5px] text-[#1E1B4B]/50">Shown on the order form and the invoice.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="glass-card rounded-[24px] p-5">
                <PartyPicker value={party} onChange={setParty} linkedParty={linkedParty} onLink={setLinkedParty} />
            </div>

            <div className="glass-card rounded-[24px] p-5">
                <ScanPanel
                    ref={scanRef}
                    title="Add designs"
                    hint="Type a design to see all its colours and enter pieces — or scan any hanging tag (set, semi-set or loose piece)."
                    placeholder="Set ID or QR ID, e.g. FL20500"
                    manualLabel="Type design"
                    live={finder}
                    onScan={handleScan}
                    feedback={feedback}
                    busy={scanning}
                />

                {scanned && (
                    <div className="mt-3.5">
                        <VariantPane
                            key={scanned.design.designId}
                            ref={scanPaneRef}
                            design={scanned.design}
                            drafts={scanDrafts.drafts[scanned.design.designId] ?? {}}
                            onDraft={(variantId, value) => scanDrafts.setDraft(scanned.design.designId, variantId, value)}
                            existing={existingFor(items, scanned.design.designId)}
                            focusVariantId={scanned.focusVariantId}
                            onCommit={(quantities) => {
                                applyQuantities(scanned.design, quantities);
                                scanDrafts.clearDesign(scanned.design.designId);
                                closeScanned();
                            }}
                            onClose={closeScanned}
                        />
                    </div>
                )}
            </div>

            <div className="glass-card rounded-[24px] p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-bold text-[#1E1B4B]">Requested items</h2>
                    </div>
                    <span className="text-xs text-[#1E1B4B]/60">
                        <b>{totals.designs}</b> designs · <b>{totals.variants}</b> variants · <b>{totals.pieces}</b> pcs
                    </span>
                </div>

                {items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#1E1B4B]/15 p-8 text-center">
                        <b className="block text-sm text-[#1E1B4B]">No items yet</b>
                        <span className="text-sm text-[#1E1B4B]/55">Type a design code above, or scan a hanging tag, to start.</span>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-white/50">
                        <div className="hidden items-center gap-4 border-b border-white/50 bg-white/40 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#1E1B4B]/45 md:flex">
                            <span className="min-w-[200px] flex-1">Design · variant</span>
                            <span className="w-20 text-right">Required pcs</span>
                            <span className="w-24 text-right">In stock</span>
                            <span className="w-28">Availability</span>
                            <span className="w-7" />
                        </div>
                        {items.map((item, index) => {
                            const short = item.quantityPcs - (item.availablePcs ?? 0);

                            return (
                                <div key={item.colorVariantId} className="flex flex-wrap items-center gap-4 border-b border-white/50 bg-white/60 px-4 py-3 last:border-b-0">
                                    <div className="flex min-w-[200px] flex-1 items-center gap-2.5">
                                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: item.colorHex }} />
                                        <div>
                                            <div className="text-sm font-semibold text-[#1E1B4B]">
                                                {item.designCode} {item.colorName}
                                            </div>
                                            <div className="text-[11.5px] text-[#1E1B4B]/45">{item.designName}</div>
                                        </div>
                                    </div>

                                    <input
                                        type="number"
                                        min="1"
                                        value={item.quantityPcs}
                                        onChange={(event) => {
                                            const quantity = Number(event.target.value);
                                            setItems((previous) => previous.map((row, rowIndex) =>
                                                rowIndex === index ? { ...row, quantityPcs: quantity } : row));
                                        }}
                                        className="w-20 rounded-lg border border-[#1E1B4B]/15 bg-white px-2 py-1.5 text-right font-mono text-sm font-bold outline-none focus:border-emerald-500"
                                    />

                                    <span className="w-24 text-right font-mono text-xs text-[#1E1B4B]/60">
                                        {item.availablePcs ?? 0} in stock
                                    </span>

                                    <span className="w-28">
                                        {short <= 0 ? (
                                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">Available</span>
                                        ) : (item.availablePcs ?? 0) === 0 ? (
                                            <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">Out of stock</span>
                                        ) : (
                                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">Short by {short}</span>
                                        )}
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() => setItems((previous) => previous.filter((_, rowIndex) => rowIndex !== index))}
                                        className="rounded-lg p-1.5 text-[#1E1B4B]/40 hover:bg-red-50 hover:text-red-600"
                                        title="Remove"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="mt-4">
                    <label className="mb-1.5 block text-xs font-semibold text-[#1E1B4B]" htmlFor="order-notes">Notes</label>
                    <input
                        id="order-notes"
                        className="pill-input"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Optional, e.g. customer prefers pastel shades"
                    />
                </div>
            </div>

            <div className="glass-card flex flex-wrap justify-end gap-2 rounded-[24px] p-4">
                <Button variant="ghost" onClick={() => navigate("/stock-out/orders")}>Cancel</Button>
                <Button
                    className="rounded-full bg-[#00694C] px-6 text-white hover:bg-[#00563e]"
                    onClick={submit}
                    disabled={saveOrderForm.isPending}
                >
                    <Check className="mr-1.5 h-4 w-4" />
                    {isEditing ? "Save changes" : "Save Order Form"}
                </Button>
            </div>

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

export default OrderFormEditor;
