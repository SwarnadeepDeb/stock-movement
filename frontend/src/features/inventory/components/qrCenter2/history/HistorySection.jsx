import { useEffect, useRef, useState } from "react";
import { useQrBatchListApi } from "../../../hooks/useQrBatchListApi.js";
import HistoryFilterBar from "./HistoryFilterBar.jsx";
import HistoryRow from "./HistoryRow.jsx";
import { cn } from "@/lib/utils";
import { EmptyState, LIST_SCROLL, ListBox, Sheet } from "../shared/primitives.jsx";

const EMPTY_FILTERS = { designId: "", colorVariantId: "", sort: "new" };

const COLUMNS = ["Challan / Date", "Design · Variant", "Sets", "Tags", "Print status", "Action"];

export default function HistorySection({ designs, onOpen, challanNo = "", onClearChallan }) {
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [statusFilter, setStatusFilter] = useState("all");
    const sectionRef = useRef(null);
    // The list API's keyword is a substring match; rows are then narrowed to the exact challan so
    // "DC-1" doesn't also show "DC-10".
    const { data: response, isLoading, isError, error } = useQrBatchListApi({
        ...filters,
        status: statusFilter,
        keyword: challanNo || undefined,
        limit: 50,
    });
    const rows = (response?.data ?? []).filter((r) => !challanNo || r.challanNo === challanNo);

    useEffect(() => {
        if (challanNo) sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [challanNo]);

    return (
        <Sheet className="scroll-mt-4">
            <div ref={sectionRef}>
                <h2 className="mb-1 text-[16.5px] font-bold tracking-[-.005em]">Stock-in history</h2>
            </div>

            {challanNo && (
                <div className="mb-3 flex flex-wrap items-center gap-2.5 text-[13px] text-slate-500">
                    <span>Showing tags for challan <b className="text-slate-900">{challanNo}</b></span>
                    <button type="button" className="font-semibold text-emerald-700 hover:underline" onClick={onClearChallan}>Show all batches</button>
                </div>
            )}

            <HistoryFilterBar
                designs={designs}
                filters={filters}
                onChange={setFilters}
                onClear={() => { setFilters(EMPTY_FILTERS); setStatusFilter("all"); }}
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                resultCount={rows.length}
            />

            <ListBox className="mt-4">
                <div role="row" className="hidden grid-cols-[1.1fr_1.5fr_.65fr_.85fr_1fr_168px] items-center gap-x-3.5 border-b border-slate-200 bg-slate-50 px-[18px] py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 xl:grid">
                    {COLUMNS.map((name, index) => <span key={name} role="columnheader" className={index === COLUMNS.length - 1 ? "text-right" : undefined}>{name}</span>)}
                </div>

                {isLoading && <EmptyState>Loading…</EmptyState>}
                {isError && <EmptyState title="Couldn't load the history">{error?.message}</EmptyState>}

                {!isLoading && !isError && rows.length === 0 && (
                    <EmptyState title="No batches match">
                        Try a different filter, or clear them to see the full history.
                    </EmptyState>
                )}
                
                {rows.map((row) => <HistoryRow key={row.batchId} row={row} onOpen={onOpen} />)}
            </ListBox>
        </Sheet>
    );
}
