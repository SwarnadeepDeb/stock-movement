// Shared style/label maps for the QR Center page. Mirrors the approved mockup's
// REASON_STYLES / status-pill conventions, translated to the qrc- CSS variable scope.

export const REASON_CODE_LABELS = {
    LOST: "Lost",
    TORN: "Torn",
    FADED: "Faded",
    REBAG: "Re-bag",
    JAM: "Jam",
    PRICE_CHANGE: "Price change",
};

// Tailwind classes keyed by reason code (backend enum) — used for pill styling.
export const REASON_CODE_STYLES = {
    LOST: "text-[var(--qrc-danger)] bg-[var(--qrc-danger-bg)] border-[var(--qrc-danger-border)]",
    TORN: "text-[var(--qrc-danger)] bg-[var(--qrc-danger-bg)] border-[var(--qrc-danger-border)]",
    FADED: "text-[var(--qrc-warn)] bg-[var(--qrc-warn-bg)] border-[var(--qrc-warn-border)]",
    REBAG: "text-[var(--qrc-info)] bg-[var(--qrc-info-bg)] border-[var(--qrc-info-border)]",
    JAM: "text-[var(--qrc-warn)] bg-[var(--qrc-warn-bg)] border-[var(--qrc-warn-border)]",
    PRICE_CHANGE: "text-[var(--qrc-info)] bg-[var(--qrc-info-bg)] border-[var(--qrc-info-border)]",
};

export function reasonLabel(code) {
    return REASON_CODE_LABELS[code] ?? code ?? "—";
}

export function reasonStyle(code) {
    return REASON_CODE_STYLES[code] ?? "text-[var(--qrc-ink3)] bg-[var(--qrc-sunken)] border-[var(--qrc-line)]";
}

// Print job status pill styling (GET /qr-center/jobs `status`)
export const JOB_STATUS_META = {
    COMPLETED: { label: "Completed", cls: "text-[var(--qrc-accent-hover)] bg-[var(--qrc-accent-bg)] border-[var(--qrc-accent-border)]" },
    JAMMED: { label: "Jammed", cls: "text-[var(--qrc-danger)] bg-[var(--qrc-danger-bg)] border-[var(--qrc-danger-border)]" },
    QUEUED: { label: "Queued", cls: "text-[var(--qrc-ink3)] bg-[var(--qrc-sunken)] border-[var(--qrc-line)]" },
    QUEUED_OFFLINE: { label: "Queued — offline", cls: "text-[var(--qrc-ink3)] bg-[var(--qrc-sunken)] border-[var(--qrc-line)]" },
    COMPLETED_UNVERIFIED: { label: "Completed — unverified", cls: "text-[var(--qrc-info)] bg-[var(--qrc-info-bg)] border-[var(--qrc-info-border)]" },
};

export function jobStatusMeta(status) {
    return JOB_STATUS_META[status] ?? { label: status ?? "—", cls: "text-[var(--qrc-ink3)] bg-[var(--qrc-sunken)] border-[var(--qrc-line)]" };
}

// Health tile -> queue tab id mapping
export const HEALTH_TILE_TAB = {
    untagged: "totag",
    reprints: "reprints",
    stale: "stale",
    dup: null,
    unverified: "jobs",
};

export const QUEUE_TABS = [
    { id: "totag", label: "To Tag" },
    { id: "reprints", label: "Reprints pending" },
    { id: "stale", label: "Stale" },
    { id: "recovery", label: "Recovery", locked: true },
    { id: "jobs", label: "Jobs" },
];

export const VOLUME_THRESHOLD = 500;

export function fmtINR(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return "₹" + n.toLocaleString("en-IN");
}

export function daysAgo(isoDate) {
    if (!isoDate) return null;
    const then = new Date(isoDate).getTime();
    if (Number.isNaN(then)) return null;
    const diffMs = Date.now() - then;
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function minutesAgo(isoDate) {
    if (!isoDate) return null;
    const then = new Date(isoDate).getTime();
    if (Number.isNaN(then)) return null;
    const diffMs = Date.now() - then;
    const mins = Math.floor(diffMs / (1000 * 60));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}
