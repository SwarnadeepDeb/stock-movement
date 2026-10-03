export function inr(value) {
    return `₹${Number(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

// "2026-09-29" -> "29 Sep 2026". Documents are read by people who write dates by hand, so the
// month is spelled rather than numbered — 09-10 is ambiguous, "10 Sep" is not.
export function longDate(iso) {
    if (!iso) return "—";

    const date = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return iso;

    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function pcs(count) {
    return `${count} pc${count === 1 ? "" : "s"}`;
}
