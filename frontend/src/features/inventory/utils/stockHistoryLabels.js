// Single place mapping the backend's event-type enum to what the user actually sees — never
// render STOCK_IN/SET_ASSEMBLED/BUNDLE_ASSEMBLED directly in the UI.
export const EVENT_TYPE_LABELS = {
    STOCK_IN: "Stock In",
    SET_ASSEMBLED: "Set Assembled",
    BUNDLE_ASSEMBLED: "Bundle Assembled",
    STOCK_OUT: "Stock Out",
    SET_BROKEN: "Set Broken",
    STOCK_ADJUSTED_IN: "Stock Added (Adjustment)",
    STOCK_ADJUSTED_OUT: "Written Off (Adjustment)",
};

export const getEventTypeLabel = (eventType) => EVENT_TYPE_LABELS[eventType] ?? eventType;

// Subtle, not a color-coded system — STOCK_IN (an addition) and STOCK_OUT (a removal) read
// slightly more emphasized than the two transformation events, which share a neutral outline
// treatment.
export const EVENT_TYPE_BADGE_VARIANT = {
    STOCK_IN: "secondary",
    SET_ASSEMBLED: "outline",
    BUNDLE_ASSEMBLED: "outline",
    STOCK_OUT: "destructive",
    STOCK_ADJUSTED_IN: "secondary",
    STOCK_ADJUSTED_OUT: "destructive",
};

export const getEventTypeBadgeVariant = (eventType) => EVENT_TYPE_BADGE_VARIANT[eventType] ?? "outline";

// STOCK_IN's quantity is physical pieces; the two assembly events count resulting units
// (1 for a single assembly, N for a bulk transformation) — the label reflects that unit,
// never re-derives or reinterprets the number.
// STOCK_IN/STOCK_OUT's quantity is physical pieces; the two assembly events always create
// exactly one resulting unit — the label reflects that unit, never re-derives or reinterprets
// the number.
export const getQuantityLabel = ({ eventType, quantity }) => {
    if (eventType === "SET_ASSEMBLED") return `${quantity} Set${quantity === 1 ? "" : "s"}`;
    if (eventType === "BUNDLE_ASSEMBLED") return `${quantity} Bundle${quantity === 1 ? "" : "s"}`;
    return `${quantity} pcs`;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

// e.g. { date: "30 Aug 2026", time: "09:32 AM" } — for the table's compact two-line cell.
export const formatHistoryDateParts = (isoTimestamp) => {
    const value = new Date(isoTimestamp);
    return { date: dateFormatter.format(value), time: timeFormatter.format(value) };
};

// e.g. "30 Aug 2026 · 09:32 AM" — for the detail dialog's single-line footer.
export const formatHistoryDateTime = (isoTimestamp) => {
    const { date, time } = formatHistoryDateParts(isoTimestamp);
    return `${date} · ${time}`;
};

// Formats a date-ONLY value (e.g. Delivery Date, stored as "YYYY-MM-DD") without ever routing
// it through `new Date("YYYY-MM-DD")` — that parses as UTC midnight, and formatting it back in
// a local timezone ahead of UTC can display the next calendar day. Parsing the parts directly
// and building a local Date from them keeps the displayed day exactly what was stored.
export const formatDateOnly = (dateOnly) => {
    if (!dateOnly) return null;

    const [year, month, day] = dateOnly.split("-").map(Number);
    if (!year || !month || !day) return dateOnly;

    return dateFormatter.format(new Date(year, month - 1, day));
};
