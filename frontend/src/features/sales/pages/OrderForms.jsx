import { useState } from "react";
import { useNavigate } from "react-router";
import { Eye, FileText, Loader2, Pencil, Plus, Receipt, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useOrderFormsApi } from "../hooks/useOrderFormsApi.js";
import { longDate, pcs } from "../utils/format.js";
import StatusPill from "../components/StatusPill.jsx";
import VariantChips from "../components/VariantChips.jsx";

const TABS = [
    { key: "", label: "All" },
    { key: "OPEN", label: "Open" },
    { key: "INVOICED", label: "Invoiced" },
    { key: "CANCELLED", label: "Cancelled" },
];

const OrderForms = () => {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");

    const debouncedSearch = useDebouncedValue(search, 300);
    const { data: response, isPending } = useOrderFormsApi({ q: debouncedSearch, status: status || undefined });

    const orderForms = response?.data ?? [];
    const counts = response?.meta?.statusCounts ?? {};
    const total = response?.meta?.total ?? 0;

    const countFor = (key) => (key ? counts[key] ?? 0 : Object.values(counts).reduce((sum, value) => sum + value, 0));

    return (
        <div className="flex flex-col">
            <div className="mb-4 flex shrink-0 flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-[#1E1B4B]">Order Forms</h1>
                </div>
                <Button
                    variant="link"
                    className="neu-button rounded-full p-4 text-[#1E1B4B] transition-colors"
                    onClick={() => navigate("/stock-out/orders/new")}
                >
                    <span className="flex items-center gap-1.5"><Plus className="h-5 w-5" /> New Order Form</span>
                </Button>
            </div>

            <div className="glass-table flex min-h-0 flex-1 flex-col space-y-2 rounded-[24px] p-2">
                <div className="flex shrink-0 flex-col gap-3 px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="neu-pressed relative flex w-full flex-1 items-center">
                        <Search className="absolute left-4 h-5 w-5 text-gray-400" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search by order form no., party, mobile or design code"
                            className="w-full border-none bg-transparent py-2 pl-12 pr-4 text-sm font-medium outline-none placeholder:text-gray-500"
                        />
                    </div>

                    <div className="toolbar-neu flex shrink-0 gap-1 rounded-xl p-1">
                        {TABS.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setStatus(tab.key)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                    status === tab.key ? "bg-white text-[#1E1B4B] shadow-sm" : "text-[#1E1B4B]/60 hover:text-[#1E1B4B]"
                                }`}
                            >
                                {tab.label}
                                <span className="ml-1 font-mono text-[10px] text-[#1E1B4B]/40">{countFor(tab.key)}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto px-1 pb-1">
                    {isPending ? (
                        <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-[#00694C]" /></div>
                    ) : orderForms.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                            <FileText className="h-10 w-10 text-[#1E1B4B]/20" />
                            <b className="text-[#1E1B4B]">{search ? "No order forms match" : "No order forms yet"}</b>
                            <span className="text-sm text-[#1E1B4B]/55">
                                {search ? "Try another number, party or design code." : "Create one when a customer shortlists designs at the counter."}
                            </span>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {orderForms.map((form) => (
                                <div key={form.id} className="flex flex-wrap items-center gap-4 rounded-2xl bg-white/70 px-5 py-4 transition-colors hover:bg-white">
                                    <div className="min-w-[132px]">
                                        <div className="font-mono text-sm font-bold text-[#1E1B4B]">{form.formNumber}</div>
                                        <div className="text-[11.5px] text-[#1E1B4B]/45">{longDate(form.formDate)}</div>
                                    </div>

                                    <div className="min-w-[150px] flex-1">
                                        <div className="text-sm font-semibold text-[#1E1B4B]">{form.party.name}</div>
                                        <div className="text-[11.5px] text-[#1E1B4B]/45">{form.party.city || "—"}</div>
                                    </div>

                                    <div className="min-w-[200px] flex-[2]"><VariantChips items={form.items} /></div>

                                    <div className="min-w-[70px] text-right font-mono text-sm text-[#1E1B4B]">{pcs(form.totalPcs)}</div>

                                    <div className="min-w-[130px]"><StatusPill form={form} /></div>

                                    <div className="flex shrink-0 gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/stock-out/orders/${form.id}`)}
                                            className="neu-button flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-[#1E1B4B]"
                                        >
                                            <Eye className="h-3.5 w-3.5" /> View
                                        </button>

                                        {form.status === "OPEN" && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/stock-out/orders/${form.id}/edit`)}
                                                    className="neu-button rounded-full p-2 text-[#1E1B4B]"
                                                    title="Edit"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/stock-out/invoices/new?orderFormId=${form.id}`)}
                                                    className="flex items-center gap-1 rounded-full bg-[#00694C] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#00563e]"
                                                >
                                                    <Receipt className="h-3.5 w-3.5" /> Invoice
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="shrink-0 px-4 pb-1 text-right text-[11.5px] text-[#1E1B4B]/45">{total} order forms</div>
            </div>
        </div>
    );
};

export default OrderForms;
