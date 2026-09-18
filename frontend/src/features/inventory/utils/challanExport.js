import { downloadBlob } from "./challanPdf";

const escapeCell = (value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const HEADER = [
    "Serial no.", "Jobber challan no.", "Jobber", "Inward date", "Issued challan no.", "Designs",
    "Complete sets", "Semi sets", "Loose pcs", "Total pcs", "Defective", "Entered by", "Status",
];

// Opens in Excel (BOM + CRLF). Rows are the challans currently matching the register filters.
export function downloadChallanRegisterCsv(challans, fileName) {
    const rows = challans.map((challan) => [
        challan.serialLabel, challan.challanNo, challan.jobberName, challan.stockDate, challan.issuedChallanNo,
        challan.designs.map((design) => `${design.code} ${design.name}`).join(", "),
        challan.sets, challan.semiSets, challan.loosePieces, challan.totalPieces, challan.defective,
        challan.enteredBy, challan.status === "DROPPED" ? "dropped" : "active",
    ]);
    const csv = [HEADER, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
    downloadBlob(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }), fileName);
}
