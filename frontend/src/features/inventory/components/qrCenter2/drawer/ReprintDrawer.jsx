import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import Drawer, { DrawerSummary } from "./Drawer.jsx";
import TagPreviewLabel from "../shared/TagPreviewLabel.jsx";
import { ActionButton, InfoNote, SectionLabel } from "../shared/primitives.jsx";
import { createQrCenterReprintApi, bulkPrintReprintsApi, getQrCenterReferenceApi, printCheckApi } from "../../../services/qrCenter.api.js";

const REASONS = ["LOST", "TORN", "FADED", "REBAG", "JAM", "PRICE_CHANGE"];

export default function ReprintDrawer({ open, onClose, targets, onDone }) {
    const [reason, setReason] = useState("REBAG");
    const [confirmed, setConfirmed] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const queryClient = useQueryClient();

    const resetAndClose = () => {
        setReason("REBAG");
        setConfirmed(false);
        onClose();
    };

    const { data: referenceResponse } = useQuery({
        queryKey: ["qr-center", "reference"],
        queryFn: getQrCenterReferenceApi,
        enabled: open,
    });
    const printers = referenceResponse?.data?.printers ?? [];
    const defaultPrinter = printers.find((p) => p.isActive) ?? printers[0];

    const n = targets?.length ?? 0;

    const handlePrint = async () => {
        if (!defaultPrinter || !targets?.length) return;
        setSubmitting(true);
        try {
            const stockItemQrIds = targets.map((t) => t.stockItemQrId).filter(Boolean);
            if (stockItemQrIds.length) {
                const check = await printCheckApi({ stockItemQrIds });
                const recentCount = check?.data?.matchedCount ?? 0;
                if (recentCount > 0 && !window.confirm(`${recentCount} of these were printed in the last few minutes. Print again?`)) {
                    setSubmitting(false);
                    return;
                }
            }

            const reprintRequestIds = [];
            for (const t of targets) {
                const created = await createQrCenterReprintApi({ stockItemId: t.stockItemId, reasonCode: reason, raisedBy: "zelero.tech@gmail.com" });
                if (created?.data?.id) reprintRequestIds.push(created.data.id);
            }
            if (reprintRequestIds.length) {
                await bulkPrintReprintsApi({ reprintRequestIds, printerId: defaultPrinter.id });
            }
            await queryClient.invalidateQueries({ queryKey: ["qr-center"] });
            onDone?.();
            resetAndClose();
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Drawer
            open={open}
            onClose={resetAndClose}
            title={`Reprint ${n} tag${n === 1 ? "" : "s"}`}
            subtitle="Exact duplicate — nothing here can change what prints"
            footer={
                <>
                    <DrawerSummary count={n}>tag{n === 1 ? "" : "s"}</DrawerSummary>
                    <ActionButton onClick={resetAndClose}>Cancel</ActionButton>
                    <ActionButton variant="primary" disabled={!confirmed || submitting || !defaultPrinter || n === 0} onClick={handlePrint}>
                        {submitting ? "Printing…" : `Print ${n} replacement${n === 1 ? "" : "s"}`}
                    </ActionButton>
                </>
            }
        >
            <div className="mb-[22px] rounded-xl border border-emerald-200 bg-emerald-50 px-[18px] py-4">
                <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[.09em] text-emerald-600">Reprinting — payload locked, codes never change</div>
                <div className="font-mono text-[19px] font-bold text-slate-900">{n} tag{n === 1 ? "" : "s"} selected</div>
            </div>

            {!defaultPrinter && (
                <InfoNote className="mb-4">No active printer is configured — add one before printing.</InfoNote>
            )}

            <div className="mb-[22px]">
                <SectionLabel>Reason — required</SectionLabel>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {REASONS.map((r) => (
                        <button
                            key={r}
                            type="button"
                            aria-pressed={reason === r}
                            onClick={() => setReason(r)}
                            className={cn(
                                "rounded-[9px] border-[1.5px] px-1.5 py-[11px] text-center text-[12.5px] font-semibold",
                                reason === r ? "border-emerald-600 bg-emerald-50 text-emerald-600" : "border-slate-200 bg-white text-slate-700",
                            )}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mb-[22px]">
                <SectionLabel>Preview</SectionLabel>
                <div className="theme-light flex max-h-[340px] flex-col items-center gap-3 overflow-y-auto rounded-[11px] bg-[#E9EEF4] p-3.5">
                    {(targets ?? []).map((t) => (
                        <TagPreviewLabel key={t.shortCode} shortCode={t.shortCode} kind={t.kind} designCode={t.designCode} designName={t.designName} colorName={t.colorName} sizeLabel={t.sizeLabel} />
                    ))}
                </div>
            </div>

            <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-[11px] border-[1.5px] border-red-200 bg-red-50 px-[15px] py-[13px]">
                <input type="checkbox" className="mt-0.5 size-4 flex-none accent-red-600" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                <span className="text-[12.8px] leading-normal text-red-800"><b>Every old label above has been physically destroyed or removed.</b> Reprinting without destroying the original leaves two labels answering to the same code — stock gets counted twice and one id never sells.</span>
            </label>
        </Drawer>
    );
}
