import { cn } from "@/lib/utils";
import { KindBadge, LIST_SCROLL, ListBox, EmptyState } from "../shared/primitives.jsx";
import QrCodeImage from "../../qr-center/QrCodeImage.jsx";

const Shell = ({ className, children }) => <ListBox className={cn("mt-4", className)}>{children}</ListBox>;

export default function ResultList({ tags, onSelect, loading, hasQuery }) {
    if (!hasQuery) {
        return (
            <Shell>
                <EmptyState title="Search or filter to begin">
                    Type a readable ID (e.g. SET-KP100-MID-007), a design code, or a challan number. Scan straight into the box with a handheld reader.
                </EmptyState>
            </Shell>
        );
    }
    if (loading) {
        return <Shell><EmptyState>Searching…</EmptyState></Shell>;
    }
    if (!tags.length) {
        return (
            <Shell>
                <EmptyState title="No tag matches">Check the code, or widen the filters.</EmptyState>
            </Shell>
        );
    }
    return (
        <Shell className={LIST_SCROLL}>
            {tags.map((t) => (
                <button
                    key={t.shortCode}
                    type="button"
                    onClick={() => onSelect(t.shortCode)}
                    className="flex w-full items-center gap-3 border-b border-slate-200 bg-white px-3.5 py-3 text-left last:border-b-0 hover:bg-slate-50 sm:gap-4 sm:px-[18px] sm:py-3.5"
                >
                    <span className="theme-light flex-none rounded-md border border-slate-200 bg-white p-[3px] leading-none">
                        <QrCodeImage value={t.shortCode} size={34} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-mono text-[13px] font-semibold [overflow-wrap:anywhere] text-slate-900">{t.displayCode ?? t.shortCode}</span>
                        <span className="mt-0.5 text-[12.5px] text-slate-500">
                            {t.design.code} · {t.design.name} · {t.variant.colorName}
                            {t.sizeLabel ? ` · size ${t.sizeLabel}` : ""}
                            {t.rack ? ` · rack ${t.rack.code}` : ""}
                            {t.displayCode ? ` · QR ${t.shortCode}` : ""}
                        </span>
                    </span>
                    <KindBadge kind={t.type} />
                </button>
            ))}
        </Shell>
    );
}
