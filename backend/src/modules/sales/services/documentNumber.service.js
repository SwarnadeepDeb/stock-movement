import ApiError from "../../../core/apiError.js";

// Suggests the next number in a series the user is typing by hand. Reads the highest number
// already used and adds one, preserving the padding of the number it was derived from, so a book
// running OF-1021, OF-1022 is offered OF-1023 rather than OF-1023000 or OF-23.
//
// Only ever a suggestion: the field stays editable, because the physical book is the authority
// and it can skip, restart or branch in ways no rule here should try to predict.
export function suggestNext(highest, prefix) {
    if (!highest) return `${prefix}1001`;

    const match = String(highest).match(/^(.*?)(\d+)\s*$/);
    if (!match) return `${prefix}1001`;

    const [, head, digits] = match;
    const next = String(Number(digits) + 1).padStart(digits.length, "0");

    return `${head}${next}`;
}

// Both documents share the same uniqueness story, so they share the error too.
export function duplicateNumberError(kind, number) {
    const label = kind === "invoice" ? "Invoice" : "Order form";

    return new ApiError(
        `${label} ${number} already exists — use a different number.`,
        409,
        kind === "invoice" ? "INVOICE_NUMBER_EXISTS" : "ORDER_FORM_NUMBER_EXISTS",
    );
}
