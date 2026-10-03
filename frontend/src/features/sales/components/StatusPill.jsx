const TONES = {
    OPEN: "bg-blue-50 text-blue-700 border-blue-200",
    INVOICED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
};

const StatusPill = ({ form }) => {
    const label = form.status === "INVOICED" && form.invoice
        ? `Invoiced · ${form.invoice.invoiceNumber}`
        : form.status.charAt(0) + form.status.slice(1).toLowerCase();

    return (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${TONES[form.status]}`}>
            {label}
        </span>
    );
};

export default StatusPill;
