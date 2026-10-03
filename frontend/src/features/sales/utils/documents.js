import { escapeHtml } from "./print.js";
import { inr, longDate } from "./format.js";

import { FIRM, FIRM_ICONS, LOGO_COLOR, LOGO_MONO } from "./firm.js";

const dash = (value) => escapeHtml(value || "—");

// Amount in words, Indian system (lakh / crore), as printed under the invoice total.
export function inWords(amount) {
    const n = Math.round(Number(amount ?? 0) * 100) / 100;
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const two = (x) => (x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? ` ${ones[x % 10]}` : ""));
    const three = (x) => {
        const hundreds = Math.floor(x / 100);
        const rest = x % 100;
        return (hundreds ? `${ones[hundreds]} Hundred${rest ? " " : ""}` : "") + (rest ? two(rest) : "");
    };

    const rupees = Math.floor(n);
    const paise = Math.round((n - rupees) * 100);
    if (!rupees && !paise) return "Rupees Zero Only";

    const words = [
        Math.floor(rupees / 1e7) ? `${two(Math.floor(rupees / 1e7))} Crore` : "",
        Math.floor(rupees / 1e5) % 100 ? `${two(Math.floor(rupees / 1e5) % 100)} Lakh` : "",
        Math.floor(rupees / 1e3) % 100 ? `${two(Math.floor(rupees / 1e3) % 100)} Thousand` : "",
        rupees % 1000 ? three(rupees % 1000) : "",
    ].filter(Boolean).join(" ");

    return `Rupees ${words || "Zero"}${paise ? ` and ${two(paise)} Paise` : ""} Only`;
}

// The order form's letterhead: coloured logo beside the firm's address and phone numbers.
function orderLetterhead() {
    return `
    <header class="ofhead">
        <img class="oflogo" src="${LOGO_COLOR}" alt="${escapeHtml(FIRM.name)}">
        <div class="offirm">
            <div class="oftag">${escapeHtml(FIRM.tagline)}</div>
            <div class="ofline">${FIRM_ICONS.pin}<span>${FIRM.address.map(escapeHtml).join("<br>")}</span></div>
            <div class="ofline">${FIRM_ICONS.phone}<span>${escapeHtml(FIRM.contact)} · <b>${escapeHtml(FIRM.mobile)}</b></span></div>
            <div class="ofline">${FIRM_ICONS.office}<span>Office · <b>${escapeHtml(FIRM.office)}</b></span></div>
            <div class="ofline">${FIRM_ICONS.mail}<span>${escapeHtml(FIRM.email)}</span></div>
        </div>
    </header>`;
}

// Order form: a checklist of what the customer asked for, one line per design colour. Rate is
// printed; amount is left blank to be filled in by hand at the counter.
export function orderFormHtml(form) {
    const party = form.party;
    const rows = form.items.map((line, index) => `
        <tr>
            <td class="c">${index + 1}</td>
            <td><b>${escapeHtml(line.designCode)}</b></td>
            <td>${escapeHtml(line.colorName)}</td>
            <td class="r"><b>${line.quantityPcs}</b></td>
            <td class="r rate">${inr(line.unitPrice)}</td>
            <td class="amt"></td>
        </tr>`).join("");

    const status = form.status === "INVOICED" ? `Invoiced · ${escapeHtml(form.invoice?.invoiceNumber ?? "")}` : escapeHtml(form.status === "OPEN" ? "Open" : form.status);

    return `
    <div class="ofd">
        ${orderLetterhead()}
        <div class="ofs-title">
            <h2>Order Form</h2>
            <div><span>Order no. <b>${escapeHtml(form.formNumber)}</b></span><span>Date <b>${escapeHtml(longDate(form.formDate))}</b></span></div>
        </div>
        <table class="ofs-info">
            <tr><th>Party</th><td colspan="3"><b>${escapeHtml(party.name)}</b></td><th>Mobile</th><td>${dash(party.mobile)}</td></tr>
            <tr><th>City</th><td>${dash(party.city)}</td><th>GST No.</th><td>${dash(party.gst)}</td><th>Transport</th><td>${dash(party.transport)}</td></tr>
            <tr><th>Agent</th><td>${dash(party.agent)}</td><th>Salesman</th><td><b>${dash(form.salesman)}</b></td><th>Status</th><td>${status}</td></tr>
        </table>
        <table class="ofs-tbl">
            <thead><tr><th class="c">#</th><th>Design</th><th>Variant</th><th class="r">Qty (pcs)</th><th class="r">Rate</th><th class="amt">Amount</th></tr></thead>
            <tbody>
                ${rows}
                <tr class="tot"><td colspan="3">Total</td><td class="r">${form.totalPcs}</td><td></td><td class="amt"></td></tr>
            </tbody>
        </table>
        <div class="ofs-end">
            ${form.notes ? `<div class="ofs-notes"><b>Notes:</b> ${escapeHtml(form.notes)}</div>` : ""}
            <div class="ofs-sign">
                <div><b>${escapeHtml(form.salesman || form.preparedBy || "")}</b>Prepared by</div>
                <div><b>&nbsp;</b>Customer</div>
                <div><b>&nbsp;</b>Checked by</div>
            </div>
        </div>
    </div>`;
}

// Invoice: formal black & white bill, one line per design colour, with the total in words.
export function invoiceHtml(invoice) {
    const party = invoice.party;
    const kv = (key, value) => `<tr><th>${key}</th><td>${value}</td></tr>`;

    const rows = invoice.lines.map((line, index) => `
        <tr>
            <td class="c">${index + 1}</td>
            <td><b>${escapeHtml(line.designCode)}</b></td>
            <td>${escapeHtml(line.colorName)}${line.isExtra ? '<span class="extra">EXTRA</span>' : ""}</td>
            <td class="r q">${line.pieces}</td>
            <td class="r q">${inr(line.unitPrice)}</td>
            <td class="r q"><b>${inr(line.amount)}</b></td>
        </tr>`).join("");

    return `
    <div class="ivd">
        <header class="ivhead">
            <img class="ivlogo" src="${LOGO_MONO}" alt="${escapeHtml(FIRM.name)}">
            <div class="ivfirm">
                <div class="ivname">${escapeHtml(FIRM.name)}</div>
                <div class="ivtag">${escapeHtml(FIRM.tagline)}</div>
                <div>${FIRM.address.map(escapeHtml).join(" ")}</div>
                <div>${escapeHtml(FIRM.contact)}: ${escapeHtml(FIRM.mobile)} &nbsp;|&nbsp; Office: ${escapeHtml(FIRM.office)} &nbsp;|&nbsp; ${escapeHtml(FIRM.email)}</div>
            </div>
        </header>
        <div class="ivtitle"><span>Invoice</span></div>
        <div class="ivboxes">
            <div class="ivbox">
                <div class="ivbt">Billed to</div>
                <div class="ivparty">${escapeHtml(party.name)}</div>
                ${party.city ? `<div>${escapeHtml(party.city)}</div>` : ""}
                ${party.mobile ? `<div>Mobile: <b>${escapeHtml(party.mobile)}</b></div>` : ""}
                ${party.gst ? `<div>GST No.: <b>${escapeHtml(party.gst)}</b></div>` : ""}
            </div>
            <div class="ivbox">
                <table class="ivkv">
                    ${kv("Invoice no.", `<b>${escapeHtml(invoice.invoiceNumber)}</b>`)}
                    ${kv("Date", `<b>${escapeHtml(longDate(invoice.invoiceDate))}</b>`)}
                    ${kv("Order form", escapeHtml(invoice.orderFormNumber ?? ""))}
                    ${invoice.salesman ? kv("Salesman", `<b>${escapeHtml(invoice.salesman)}</b>`) : ""}
                    ${party.transport ? kv("Transport", escapeHtml(party.transport)) : ""}
                </table>
            </div>
        </div>
        <table class="ivtbl">
            <thead><tr><th class="c">#</th><th>Design</th><th>Variant</th><th class="r">Pcs</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
            <tbody>
                ${rows}
                <tr class="tot"><td colspan="3">Total</td><td class="r q">${invoice.totalPcs}</td><td></td><td class="r q">${inr(invoice.totalAmount)}</td></tr>
            </tbody>
        </table>
        <div class="ivend">
            <div class="ivtotal">
                <div class="ivwords"><span>Amount in words</span><b>${escapeHtml(inWords(invoice.totalAmount))}</b></div>
                <table class="ivkv ivsum">
                    ${kv("Total pieces", `<b>${invoice.totalPcs}</b>`)}
                    ${kv("Grand total", `<b>${inr(invoice.totalAmount)}</b>`)}
                </table>
            </div>
            <div class="ivsign">
                <div>Receiver’s signature</div>
                <div class="auth">For ${escapeHtml(FIRM.name)}<br><br><br>Authorised Signatory</div>
            </div>
        </div>
    </div>`;
}

export function orderFormCsvRows(form) {
    return [
        ["Order form no.", form.formNumber],
        ["Date", form.formDate],
        ["Salesman", form.salesman ?? ""],
        ["Party", form.party.name],
        ["Mobile", form.party.mobile],
        ["City", form.party.city],
        ["GST No.", form.party.gst],
        ["Transport", form.party.transport],
        ["Agent", form.party.agent],
        ["Status", form.status],
        [],
        ["Design", "Design name", "Colour", "Required pcs", "In stock"],
        ...form.items.map((item) => [item.designCode, item.designName, item.colorName, item.quantityPcs, item.availablePcs ?? ""]),
        [],
        ["Total", "", "", form.totalPcs, ""],
    ];
}

export function invoiceCsvRows(invoice) {
    return [
        ["Invoice no.", invoice.invoiceNumber],
        ["Date", invoice.invoiceDate],
        ["Order form", invoice.orderFormNumber],
        ["Salesman", invoice.salesman ?? ""],
        ["Party", invoice.party.name],
        ["Mobile", invoice.party.mobile],
        ["GST No.", invoice.party.gst],
        [],
        ["Design", "Colour", "Packed as", "Sizes", "Pcs", "Rate / pc", "Amount", "Extra"],
        ...invoice.lines.map((line) => [
            line.designCode,
            line.colorName,
            line.packedAs,
            Object.entries(line.sizes).map(([label, count]) => `${label}:${count}`).join(" "),
            line.pieces,
            line.unitPrice,
            line.amount,
            line.isExtra ? "YES" : "",
        ]),
        [],
        ["Total", "", "", "", invoice.totalPcs, "", invoice.totalAmount, ""],
        [],
        ["Scanned tags"],
        ["Tag", "Type", "Design", "Colour", "Pieces", "Sizes", "Method"],
        ...invoice.lines.flatMap((line) => line.tags.map((tag) => [
            tag.scanCode,
            tag.kind,
            line.designCode,
            line.colorName,
            tag.pieces,
            (tag.sizeBreakdown ?? []).map((size) => `${size.sizeLabel}:${size.quantity}`).join(" "),
            tag.method,
        ])),
    ];
}
