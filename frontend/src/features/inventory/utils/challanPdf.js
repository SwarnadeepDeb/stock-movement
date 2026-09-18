import { jsPDF } from "jspdf";

import { formatDateOnly } from "./stockHistoryLabels";

// The firm printed on the challan header band. Kept in one place so it can move to settings
// when the app has a firm profile.
export const CHALLAN_FIRM_NAME = "SAKSHAM'S FASHIONS";

// A5 portrait, mm. Rows are 8.6 mm tall; the first page carries the details block, so it fits
// fewer rows than continuation pages. The last page also holds the total and signatures.
const PAGE = { width: 148, height: 210, margin: 11, rowHeight: 8.6 };
const ROWS = { first: 12, firstLast: 8, next: 17, nextLast: 13 };

// One row per design: pieces summed across the design's colour variants.
export function designRows(challan) {
    const rows = new Map();
    for (const line of challan.lines ?? []) {
        const current = rows.get(line.designCode) ?? { design: line.designCode, name: line.designName, pieces: 0 };
        current.pieces += line.pieces;
        rows.set(line.designCode, current);
    }
    return [...rows.values()];
}

// Splits design rows over as many pages as needed, always leaving at least one row for the last
// page so the total and signatures never sit on a page of their own.
export function paginate(rows) {
    const pages = [];
    let index = 0;
    for (;;) {
        const first = pages.length === 0;
        const left = rows.length - index;
        const capacityLast = first ? ROWS.firstLast : ROWS.nextLast;
        const capacity = first ? ROWS.first : ROWS.next;
        if (left <= capacityLast) {
            pages.push(rows.slice(index));
            return pages;
        }
        const take = Math.min(capacity, left - 1);
        pages.push(rows.slice(index, index + take));
        index += take;
    }
}

// jsPDF's built-in fonts only cover Latin-1, so typographic characters are flattened first.
const ascii = (text) => String(text ?? "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-");

export function buildChallanPdf(challan) {
    const doc = new jsPDF({ unit: "mm", format: [PAGE.width, PAGE.height], orientation: "portrait" });
    const { width: W, margin: x0, rowHeight } = PAGE;
    const x1 = W - x0;
    const rows = designRows(challan);
    const pages = paginate(rows);
    const total = challan.totalPieces ?? rows.reduce((sum, row) => sum + row.pieces, 0);
    const dropped = challan.status === "DROPPED";
    const printed = formatDateOnly(new Date().toISOString().slice(0, 10));
    const firm = ascii(CHALLAN_FIRM_NAME);

    const rule = (y, weight = 0.35) => { doc.setDrawColor(15); doc.setLineWidth(weight); doc.line(x0, y, x1, y); };
    const shade = (y, h) => { doc.setFillColor(229, 231, 235); doc.rect(x0, y, x1 - x0, h, "F"); };
    const meta = (key, value, x, y) => {
        doc.setFont("helvetica", "bold"); doc.setFontSize(6.6); doc.setTextColor(100); doc.text(key.toUpperCase(), x, y);
        doc.setFontSize(9.4); doc.setTextColor(15); doc.text(doc.splitTextToSize(ascii(value), 40)[0], x, y + 5);
    };

    pages.forEach((pageRows, pageIndex) => {
        const first = pageIndex === 0;
        const last = pageIndex === pages.length - 1;
        if (pageIndex) doc.addPage([PAGE.width, PAGE.height], "portrait");

        // Header band on every page.
        doc.setFillColor(15, 23, 42); doc.rect(0, 0, W, 19, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(255);
        doc.text(firm, W / 2, 11.8, { align: "center", charSpace: 1 });
        doc.setTextColor(15);

        // Watermark first so all challan text prints on top of it.
        if (dropped) {
            doc.setFont("helvetica", "bold"); doc.setFontSize(44); doc.setTextColor(252, 220, 220);
            doc.text("DROPPED", W / 2, 125, { align: "center", angle: 24 });
            doc.setTextColor(15);
        }

        let y;
        if (first) {
            doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Stock Inward Challan", x0, 30);
            doc.setFont("helvetica", "normal"); doc.setFontSize(8.2); doc.setTextColor(100); doc.text("Goods received from jobber", x0, 35);
            doc.setFont("helvetica", "bold"); doc.setFontSize(6.6); doc.text("JOBBER CHALLAN NO.", x1, 29, { align: "right" });
            doc.setFontSize(11); doc.setTextColor(15); doc.text(ascii(challan.challanNo), x1, 35, { align: "right" });
            // Keep the serial clear of a long challan number.
            const challanWidth = Math.max(doc.getTextWidth(ascii(challan.challanNo)), 24);
            doc.setFontSize(6.6); doc.setTextColor(100); doc.text("SR. NO.", x1 - challanWidth - 8, 29, { align: "right" });
            doc.setFontSize(11); doc.setTextColor(15); doc.text(challan.serialLabel, x1 - challanWidth - 8, 35, { align: "right" });
            rule(40);
            meta("Jobber", challan.jobberName || "-", x0, 47);
            meta("Issued challan no.", challan.issuedChallanNo || "-", x0 + 43, 47);
            meta("Inward date", formatDateOnly(challan.stockDate), x0 + 86, 47);
            meta("Received by", challan.enteredBy || "-", x0, 61);
            rule(71);
            y = 75;
        } else {
            doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(15); doc.text("Stock Inward Challan", x0, 27);
            doc.setFont("helvetica", "normal"); doc.setTextColor(100); doc.text("- continued", x0 + 34, 27);
            doc.setTextColor(15); doc.setFont("helvetica", "bold");
            doc.text(`Sr. ${challan.serialLabel}  -  ${ascii(challan.challanNo)}`, x1, 27, { align: "right" });
            doc.setFont("helvetica", "normal"); doc.setFontSize(7.6); doc.setTextColor(100);
            doc.text(`${ascii(challan.jobberName)} - ${formatDateOnly(challan.stockDate)}`, x1, 31.5, { align: "right" });
            rule(34);
            y = 37;
        }

        shade(y, 8);
        doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(30);
        doc.text("DESIGN", x0 + 3, y + 5.4); doc.text("PIECES", x1 - 3, y + 5.4, { align: "right" });
        rule(y + 8, 0.35);
        y += 8;

        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(15);
        pageRows.forEach((row) => {
            doc.text(ascii(row.design), x0 + 3, y + 6);
            doc.text(String(row.pieces), x1 - 3, y + 6, { align: "right" });
            doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2); doc.line(x0, y + rowHeight, x1, y + rowHeight);
            y += rowHeight;
        });

        if (last) {
            rule(y, 0.45); shade(y + 0.3, 8.4); rule(y + 8.7, 0.45);
            doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(15);
            doc.text(`Total${pages.length > 1 ? `  (all ${pages.length} pages)` : ""}`, x0 + 3, y + 6);
            doc.text(String(total), x1 - 3, y + 6, { align: "right" });
            y += 9;
            if (dropped) {
                doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(220, 38, 38);
                doc.text(doc.splitTextToSize(ascii(`DROPPED - ${challan.voidReason} (serial ${challan.serialLabel} retired)`), x1 - x0), x0, y + 6);
            }
            const signY = Math.min(188, Math.max(y + 20, 178));
            doc.setDrawColor(15); doc.setLineWidth(0.3); doc.setTextColor(70); doc.setFont("helvetica", "normal"); doc.setFontSize(8.4);
            doc.line(x0, signY, x0 + 50, signY); doc.text("Received by", x0 + 25, signY + 4.6, { align: "center" });
            doc.line(x1 - 50, signY, x1, signY); doc.text("Checked by", x1 - 25, signY + 4.6, { align: "center" });
        } else {
            doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(100);
            doc.text(`Continued on page ${pageIndex + 2} ->`, x1, y + 6, { align: "right" });
        }

        doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(120);
        doc.text(`${firm} - Sr. ${challan.serialLabel} - challan ${ascii(challan.challanNo)}`, x0, 202);
        doc.text(`${pages.length > 1 ? `Page ${pageIndex + 1} of ${pages.length}  -  ` : ""}Printed ${printed}`, x1, 202, { align: "right" });
    });

    return { doc, pageCount: pages.length };
}

export const challanFileName = (challan, extension) =>
    `Challan_${challan.serialLabel}_${challan.challanNo}_${challan.jobberName ?? ""}`.replace(/[^\w-]+/g, "_") + `.${extension}`;

export function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
