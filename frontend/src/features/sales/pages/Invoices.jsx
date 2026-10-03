import { useState } from "react";
import { useNavigate } from "react-router";
import { Eye, Loader2, Pencil, Plus, Receipt, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useInvoicesApi } from "../hooks/useInvoicesApi.js";
import { inr, longDate } from "../utils/format.js";
import VariantChips from "../components/VariantChips.jsx";

const Invoices = () => {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");

    const debouncedSearch = useDebouncedValue(search, 300);
    const { data: response, isPending } = useInvoicesApi({ q: debouncedSearch });

    const invoices = response?.data ?? [];
    const total = response?.meta?.total ?? 0;

    return (
        <div className="flex flex-col">
            <div className="mb-4 flex shrink-0 flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-[#1E1B4B]">Invoices</h1>
                </div>
                <Button
                    variant="link"
                    className="neu-button rounded-full p-4 text-[#1E1B4B] transition-colors"
                    onClick={() => navigate("/stock-out/invoices/new")}
                >
                    <span className="flex items-center gap-1.5"><Plus className="h-5 w-5" /> New Invoice</span>
                </Button>
            </div>

            <div className="glass-table flex min-h-0 flex-1 flex-col space-y-2 rounded-[24px] p-2">
                <div className="flex shrink-0 items-center gap-4 px-3 py-2.5">
                    <div className="neu-pressed relative flex w-full flex-1 items-center">
                        <Search className="absolute left-4 h-5 w-5 text-gray-400" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search by invoice no., order form no., party or design code"
                            className="w-full border-none bg-transparent py-2 pl-12 pr-4 text-sm font-medium outline-none placeholder:text-gray-500"
                        />
                    </div>
                    <span className="shrink-0 text-xs text-[#1E1B4B]/45">{total} invoices</span>
                </div>

                <div className="min-h-0 flex-1 overflow-auto px-1 pb-1">
                    {isPending ? (
                        <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-[#00694C]" /></div>
                    ) : invoices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                            <Receipt className="h-10 w-10 text-[#1E1B4B]/20" />
                            <b className="text-[#1E1B4B]">{search ? "No invoices match" : "No invoices yet"}</b>
                            <span className="text-sm text-[#1E1B4B]/55">
                                {search ? "Try another number or party." : "Generate one by picking stock against an order form."}
                            </span>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {invoices.map((invoice) => (
                                <div key={invoice.id} className="flex flex-wrap items-center gap-4 rounded-2xl bg-white/70 px-5 py-4 transition-colors hover:bg-white">
                                    <div className="min-w-[140px]">
                                        <div className="font-mono text-sm font-bold text-[#1E1B4B]">{invoice.invoiceNumber}</div>
                                        <div className="text-[11.5px] text-[#1E1B4B]/45">{longDate(invoice.invoiceDate)}</div>
                                    </div>

                                    <div className="min-w-[100px] font-mono text-xs text-[#1E1B4B]/60">{invoice.orderFormNumber}</div>

                                    <div className="min-w-[150px] flex-1">
                                        <div className="text-sm font-semibold text-[#1E1B4B]">{invoice.party.name}</div>
                                        <div className="text-[11.5px] text-[#1E1B4B]/45">{invoice.party.city || "—"}</div>
                                    </div>

                                    <div className="min-w-[180px] flex-[2]">
                                        <VariantChips items={invoice.lines} max={3} />
                                    </div>

                                    <div className="min-w-[60px] text-right font-mono text-sm text-[#1E1B4B]">{invoice.totalPcs}</div>
                                    <div className="min-w-[90px] text-right font-mono text-sm font-bold text-[#1E1B4B]">{inr(invoice.totalAmount)}</div>

                                    <div className="flex shrink-0 gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/stock-out/invoices/${invoice.id}`)}
                                            className="neu-button flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-[#1E1B4B]"
                                        >
                                            <Eye className="h-3.5 w-3.5" /> View
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => navigate(`/stock-out/invoices/${invoice.id}/edit`)}
                                            className="neu-button rounded-full p-2 text-[#1E1B4B]"
                                            title="Edit invoice"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Invoices;
