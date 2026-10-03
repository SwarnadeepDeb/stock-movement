import { useNavigate, useParams } from "react-router";
import { toast } from "react-toastify";
import { ArrowLeft, Download, Image, Loader2, Pencil, Printer, Receipt } from "lucide-react";
import { useOrderFormApi } from "../hooks/useOrderFormsApi.js";
import { orderFormCsvRows, orderFormHtml } from "../utils/documents.js";
import { downloadCsv } from "../utils/csv.js";
import { printHtml } from "../utils/print.js";
import { longDate } from "../utils/format.js";
import StatusPill from "../components/StatusPill.jsx";
import DocumentPreview from "../components/DocumentPreview.jsx";

const OrderFormDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data: response, isPending, isError, error } = useOrderFormApi(id);
    const form = response?.data;

    if (isPending) {
        return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-[#00694C]" /></div>;
    }

    if (isError) {
        return (
            <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 rounded-[24px] text-center">
                <b className="text-[#1E1B4B]">Order form not found</b>
                <span className="text-sm text-[#1E1B4B]/55">{error.message}</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 pb-4">
            <div className="glass-card rounded-[24px] p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <button
                            type="button"
                            onClick={() => navigate("/stock-out/orders")}
                            className="mb-1 flex items-center gap-1 text-xs font-semibold text-[#1E1B4B]/60 hover:text-[#1E1B4B]"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" /> Order Forms
                        </button>
                        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-[#1E1B4B]">
                            {form.formNumber} <StatusPill form={form} />
                        </h1>
                        <p className="mt-1 text-sm text-[#1E1B4B]/60">
                            {form.party.name} · {longDate(form.formDate)}{form.salesman ? ` · Salesman ${form.salesman}` : ""} · {form.totalPcs} pcs requested
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => printHtml(`Order form ${form.formNumber}`, orderFormHtml(form), `Order form ${form.formNumber} · ${form.party.name}`)}
                            className="neu-button flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-[#1E1B4B]"
                        >
                            <Printer className="h-4 w-4" /> Print
                        </button>
                        <button
                            type="button"
                            onClick={() => { downloadCsv(`${form.formNumber}.csv`, orderFormCsvRows(form)); toast.success(`Downloaded ${form.formNumber}.csv`); }}
                            className="neu-button flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-[#1E1B4B]"
                        >
                            <Download className="h-4 w-4" /> Excel
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate(`/gallery?mode=orderForm&number=${encodeURIComponent(form.formNumber)}`)}
                            className="neu-button flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-[#1E1B4B]"
                        >
                            <Image className="h-4 w-4" /> Photos
                        </button>

                        {form.status === "OPEN" && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => navigate(`/stock-out/orders/${form.id}/edit`)}
                                    className="neu-button flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-[#1E1B4B]"
                                >
                                    <Pencil className="h-4 w-4" /> Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate(`/stock-out/invoices/new?orderFormId=${form.id}`)}
                                    className="flex items-center gap-1.5 rounded-full bg-[#00694C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#00563e]"
                                >
                                    <Receipt className="h-4 w-4" /> Create Invoice
                                </button>
                            </>
                        )}

                        {form.invoice && (
                            <button
                                type="button"
                                onClick={() => navigate(`/stock-out/invoices/${form.invoice.id}`)}
                                className="flex items-center gap-1.5 rounded-full bg-[#1E1B4B] px-4 py-2 text-xs font-semibold text-white"
                            >
                                View {form.invoice.invoiceNumber}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <DocumentPreview html={orderFormHtml(form)} />
        </div>
    );
};

export default OrderFormDetail;
