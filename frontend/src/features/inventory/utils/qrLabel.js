// The QR encodes exactly what the backend already persists as stock_item_qr.payload — a
// snapshot taken when the QR was generated. It intentionally is NOT re-derived from live
// stock data (that would change what a printed, already-applied label decodes to).
export const buildQrValue = (payload) => JSON.stringify(payload);

const toSafeSegment = (value) =>
    String(value ?? "")
        .trim()
        .replace(/[^a-zA-Z0-9-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

// e.g. "FL205-Blue-SET-stock-142.png" — never a generic "download.png".
export const buildQrFilename = ({ designCode, colorName, type, stockItemId }) => {
    const parts = [designCode, colorName, type, `stock-${stockItemId}`].map(toSafeSegment).filter(Boolean);
    return `${parts.join("-") || "qr-label"}.png`;
};
