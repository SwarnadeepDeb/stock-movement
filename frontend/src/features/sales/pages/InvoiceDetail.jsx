import { useNavigate, useParams } from "react-router";
import { toast } from "react-toastify";
import { ArrowLeft, Download, FileText, Image, Loader2, Pencil, Printer } from "lucide-react";
import { useInvoiceApi } from "../hooks/useInvoicesApi.js";
import { invoiceCsvRows, invoiceHtml } from "../utils/documents.js";
import { downloadCsv } from "../utils/csv.js";
import { printHtml } from "../utils/print.js";
import { inr, longDate } from "../utils/format.js";
import DocumentPreview from "../components/DocumentPreview.jsx";

const InvoiceDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const { data: response, isPending, isError, error } = useInvoiceApi(id);
    const invoice = response?.data;

    if (isPending) {
        return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-[#00694C]" /></div>;
    }

    if (isError) {
        return (
            <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 rounded-[24px] text-center">
                <b className="text-[#1E1B4B]">Invoice not found</b>
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
                            onClick={() => navigate("/stock-out/invoices")}
                            className="mb-1 flex items-center gap-1 text-xs font-semibold text-[#1E1B4B]/60 hover:text-[#1E1B4B]"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" /> Invoices
                        </button>
                        <h1 className="text-2xl font-bold tracking-tight text-[#1E1B4B]">{invoice.invoiceNumber}</h1>
                        <p className="mt-1 text-sm text-[#1E1B4B]/60">
                            {invoice.party.name} · {longDate(invoice.invoiceDate)}{invoice.salesman ? ` · Salesman ${invoice.salesman}` : ""} · {invoice.totalPcs} pcs ·{" "}
                            <b className="text-[#1E1B4B]">{inr(invoice.totalAmount)}</b>
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => printHtml(`Invoice ${invoice.invoiceNumber}`, invoiceHtml(invoice), `Invoice ${invoice.invoiceNumber} · ${invoice.party.name}`)}
                            className="neu-button flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-[#1E1B4B]"
                        >
                            <Printer className="h-4 w-4" /> Print
                        </button>
                        <button
                            type="button"
                            onClick={() => { downloadCsv(`${invoice.invoiceNumber}.csv`, invoiceCsvRows(invoice)); toast.success(`Downloaded ${invoice.invoiceNumber}.csv`); }}
                            className="neu-button flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-[#1E1B4B]"
                        >
                            <Download className="h-4 w-4" /> Excel
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate(`/gallery?mode=invoice&number=${encodeURIComponent(invoice.invoiceNumber)}`)}
                            className="neu-button flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-[#1E1B4B]"
                        >
                            <Image className="h-4 w-4" /> Photos
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate(`/stock-out/orders/${invoice.orderFormId}`)}
                            className="neu-button flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-[#1E1B4B]"
                        >
                            <FileText className="h-4 w-4" /> {invoice.orderFormNumber}
                        </button>

                        <button
                            type="button"
                            onClick={() => navigate(`/stock-out/invoices/${invoice.id}/edit`)}
                            className="flex items-center gap-1.5 rounded-full bg-[#00694C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#00563e]"
                        >
                            <Pencil className="h-4 w-4" /> Edit invoice
                        </button>
                    </div>
                </div>
            </div>

            <DocumentPreview html={invoiceHtml(invoice)} />
        </div>
    );
};

export default InvoiceDetail;
