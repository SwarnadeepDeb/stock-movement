import { useNavigate } from "react-router";
import { ArrowRight, FileText, Receipt } from "lucide-react";
import { useOverviewApi } from "../hooks/useSalesApi.js";
import { inr, longDate } from "../utils/format.js";

const STEPS = [
    "Customer shortlists at the counter",
    "Order Form (checklist)",
    "Pick & scan in the godown",
    "Invoice — stock deducted",
];

const ACTIONS = [
    {
        to: "/stock-out/orders/new",
        icon: FileText,
        tone: "bg-blue-50 text-blue-700",
        title: "New Order Form",
        description: "Scan the hanging designs the customer shortlists and note pieces per colour. Doesn't touch stock.",
    },
    {
        to: "/stock-out/invoices/new",
        icon: Receipt,
        tone: "bg-emerald-50 text-emerald-700",
        title: "New Invoice",
        description: "Fetch an order form as your checklist, scan the actual stock you pick, and bill it. Stock is deducted here.",
    },
];

const Overview = () => {
    const navigate = useNavigate();
    const { data: response } = useOverviewApi();
    const summary = response?.data;

    const stats = [
        { label: "Order forms waiting to invoice", value: summary?.openOrderForms, accent: "text-blue-700" },
        { label: "Invoices this month", value: summary?.invoicesThisMonth },
        { label: "Pieces dispatched this month", value: summary?.piecesThisMonth },
        { label: "Invoiced this month", value: summary ? inr(summary.amountThisMonth) : undefined, accent: "text-[#00694C]" },
    ];

    return (
        <div className="flex flex-col gap-4 pb-4">
            <div className="glass-card rounded-[24px] p-6">
                <h1 className="text-3xl font-bold tracking-tight text-[#1E1B4B]">Stock Out</h1>
                <p className="mt-1 max-w-[72ch] text-sm text-[#1E1B4B]/60">
                    Note what the customer wants at the counter, then pick it from the godown and bill it — stock
                    updates only when the invoice is generated.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {ACTIONS.map((action) => (
                    <button
                        key={action.to}
                        type="button"
                        onClick={() => navigate(action.to)}
                        className="glass-card flex w-full items-start gap-4 rounded-[20px] p-5 text-left transition-shadow hover:shadow-lg"
                    >
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${action.tone}`}>
                            <action.icon className="h-5 w-5" />
                        </span>
                        <span>
                            <span className="block text-base font-bold text-[#1E1B4B]">{action.title}</span>
                            <span className="mt-0.5 block text-sm text-[#1E1B4B]/60">{action.description}</span>
                        </span>
                    </button>
                ))}
            </div>

            <div className="glass-card rounded-[24px] p-6">
                <div className="flex flex-wrap items-center gap-2 text-sm text-[#1E1B4B]/60">
                    {STEPS.map((step, index) => (
                        <span key={step} className="flex items-center gap-2">
                            <span className="flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/70 text-[11px] font-bold text-[#1E1B4B]">
                                    {index + 1}
                                </span>
                                {step}
                            </span>
                            {index < STEPS.length - 1 && <ArrowRight className="h-3.5 w-3.5" />}
                        </span>
                    ))}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/50 bg-white/30 lg:grid-cols-4">
                    {stats.map((stat) => (
                        <div key={stat.label} className="bg-white/50 px-5 py-4">
                            <div className={`font-mono text-xl font-bold ${stat.accent ?? "text-[#1E1B4B]"}`}>
                                {stat.value ?? "—"}
                            </div>
                            <div className="mt-0.5 text-[11px] text-[#1E1B4B]/55">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <RecentPanel
                    title="Recent order forms"
                    emptyLabel="No order forms yet."
                    onViewAll={() => navigate("/stock-out/orders")}
                    rows={summary?.recentOrderForms?.map((form) => ({
                        id: form.id,
                        number: form.formNumber,
                        date: form.formDate,
                        party: form.partyName,
                        badge: form.status === "INVOICED" ? "Invoiced" : form.status === "CANCELLED" ? "Cancelled" : "Open",
                        to: `/stock-out/orders/${form.id}`,
                    }))}
                    navigate={navigate}
                />

                <RecentPanel
                    title="Recent invoices"
                    emptyLabel="No invoices yet."
                    onViewAll={() => navigate("/stock-out/invoices")}
                    rows={summary?.recentInvoices?.map((invoice) => ({
                        id: invoice.id,
                        number: invoice.invoiceNumber,
                        date: invoice.invoiceDate,
                        party: invoice.partyName,
                        badge: invoice.orderFormNumber,
                        to: `/stock-out/invoices/${invoice.id}`,
                    }))}
                    navigate={navigate}
                />
            </div>
        </div>
    );
};

const RecentPanel = ({ title, rows, emptyLabel, onViewAll, navigate }) => (
    <div className="glass-card rounded-[24px] p-5">
        <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-[#1E1B4B]">{title}</h2>
            <button type="button" onClick={onViewAll} className="text-xs font-semibold text-[#1E1B4B]/55 hover:text-[#1E1B4B]">
                View all &rarr;
            </button>
        </div>

        {!rows || rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#1E1B4B]/45">{emptyLabel}</p>
        ) : (
            <div className="space-y-1.5">
                {rows.map((row) => (
                    <button
                        key={row.id}
                        type="button"
                        onClick={() => navigate(row.to)}
                        className="flex w-full items-center gap-3 rounded-xl bg-white/60 px-3 py-2.5 text-left transition-colors hover:bg-white"
                    >
                        <span className="font-mono text-xs font-bold text-[#1E1B4B]">{row.number}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-[#1E1B4B]/75">{row.party}</span>
                        <span className="text-[11px] text-[#1E1B4B]/40">{longDate(row.date)}</span>
                        <span className="rounded-full bg-[#1E1B4B]/8 px-2 py-0.5 text-[10.5px] font-semibold text-[#1E1B4B]/65">
                            {row.badge}
                        </span>
                    </button>
                ))}
            </div>
        )}
    </div>
);

export default Overview;
