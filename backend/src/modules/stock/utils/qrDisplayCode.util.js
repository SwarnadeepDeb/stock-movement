// The human-readable id printed next to a QR — "SET-KP100-MID-007", "SEMI-KP100-MID-008",
// "KP100-MID-0012" (a piece inside a set) or "LSE-KP100-MID-0013" (a loose piece). It is built
// from the colour's code plus the stock item's serialNo, so it is never stored on its own; this
// file is the one place that knows its shape, for printing it and for reading it back when a
// worker types it off a label instead of scanning the QR.

// Same colour label the Stock In wizard shows (frontend utils/variantDisplay.js#getVariantDisplayCode).
export const variantCodeOf = ({ designCode, colorName }) =>
    `${designCode ?? "DSN"}-${(colorName ?? "").replace(/\s+/g, "").slice(0, 3).toUpperCase()}`;

const DISPLAY_CODE = /^(?:(SET|SEMI|LSE)-)?(.+)-(\d+)$/;

// { variantCode, serialNo, types } for a typed display code, or null when the text can't be one.
// Sets and semi sets share one serial counter per colour, and child and loose pieces share the
// other, so the prefix only decides which counter — not which of SET/BUNDLE or child/loose.
export function parseDisplayCode(text) {
    const match = DISPLAY_CODE.exec(String(text ?? "").trim().toUpperCase());
    if (!match) return null;

    const [, prefix, variantCode, digits] = match;
    const serialNo = Number(digits);
    if (!Number.isSafeInteger(serialNo) || serialNo <= 0) return null;

    const isParent = prefix === "SET" || prefix === "SEMI";
    return { variantCode, serialNo, types: isParent ? ["SET", "BUNDLE"] : ["PIECE"] };
}

const pad = (value, width) => String(value).padStart(width, "0");

// The readable id for one stock item, or null when it has no serial yet (a tag whose number is
// only issued on first print). Mirrors what QrBatchService prints on the label: SET-/SEMI- plus
// a 3-digit serial for a parent, a bare 4-digit serial for a piece inside a set, and LSE- for a
// loose piece.
export function buildDisplayCode({ type, serialNo, isSemi, isChildPiece, designCode, colorName }) {
    if (serialNo == null) return null;
    const variantCode = variantCodeOf({ designCode, colorName });
    if (type === "SET" || type === "BUNDLE") return `${isSemi ? "SEMI" : "SET"}-${variantCode}-${pad(serialNo, 3)}`;
    return `${isChildPiece ? "" : "LSE-"}${variantCode}-${pad(serialNo, 4)}`;
}
