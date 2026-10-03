// Downloads rows as CSV. The BOM is deliberate: without it Excel on Windows renders the rupee
// sign and any non-ASCII party name as mojibake.
export function downloadCsv(filename, rows) {
    const body = rows.map((row) => row.map((cell) => {
        const value = String(cell ?? "");
        return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(",")).join("\r\n");

    const blob = new Blob([`﻿${body}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
        URL.revokeObjectURL(url);
        link.remove();
    }, 500);
}
