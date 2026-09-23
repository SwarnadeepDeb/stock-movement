import { cn } from "@/lib/utils";
import TagPreviewLabel from "../shared/TagPreviewLabel.jsx";
import { ActionButton, EmptyState, InfoNote, KindBadge, ListBox } from "../shared/primitives.jsx";

// `tone="blue"` is the retired-tag variant of the card.
function Card({ tone = "green", children }) {
    return (
        <div className={cn("mt-4 overflow-hidden rounded-[14px] border bg-white", tone === "blue" ? "border-blue-200" : "border-emerald-200")}>
            {children}
        </div>
    );
}

function DetailHead({ code, kind, tone = "green", onBack }) {
    return (
        <div
            className={cn(
                "flex flex-wrap items-center justify-between gap-3.5 border-b px-3.5 py-3 sm:px-5 sm:py-3.5",
                tone === "blue" ? "border-blue-200 bg-blue-50" : "border-emerald-200 bg-emerald-50",
            )}
        >
            <span className="flex items-center gap-2.5 font-mono text-sm font-bold [overflow-wrap:anywhere] sm:text-[15.5px]">
                {code} {kind && <KindBadge kind={kind} />}
            </span>
            <button type="button" className="text-[12.8px] text-slate-500 hover:text-slate-900" onClick={() => onBack(null)}>Back to results</button>
        </div>
    );
}

// Label preview on the left (stacks on top on narrow screens), details on the right.
function Body({ preview, children }) {
    return (
        <div className={cn("grid gap-5 px-3.5 py-4 sm:px-5 sm:py-5", preview && "md:grid-cols-[auto_1fr] md:gap-6")}>
            {preview}
            <div>{children}</div>
        </div>
    );
}

function Title({ children }) {
    return <div className="mb-0.5 text-lg font-bold tracking-[-.012em] sm:text-xl">{children}</div>;
}

function Meta({ children }) {
    return <div className="text-[13.8px] text-slate-500">{children}</div>;
}

function FieldGrid({ children }) {
    return (
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3.5 border-t border-dashed border-slate-200 pt-4 sm:grid-cols-[repeat(auto-fit,minmax(120px,1fr))] sm:gap-x-5">
            {children}
        </div>
    );
}

function Field({ k, v, sm }) {
    return (
        <div>
            <div className="mb-0.5 text-[10.5px] font-bold uppercase tracking-[.07em] text-slate-400">{k}</div>
            <div className={cn("font-mono font-semibold [overflow-wrap:anywhere]", sm ? "text-[12.3px]" : "text-[13.8px]")}>{v}</div>
        </div>
    );
}

function Actions({ children }) {
    return (
        <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-200 bg-slate-50 p-3.5 *:flex-auto sm:px-5 sm:py-4 sm:*:flex-none">
            {children}
        </div>
    );
}

function ChildRows({ className, children }) {
    return <ListBox className={cn("mx-3.5 mb-3.5 rounded-[11px] sm:mx-5 sm:mb-5", className)}>{children}</ListBox>;
}

function ChildRow({ as: Tag = "div", label, status, ...props }) {
    return (
        <Tag className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 bg-white px-4 py-2.5 text-left last:border-b-0" {...props}>
            <span className="min-w-0 flex-1 font-mono text-[12.3px] text-slate-700">{label}</span>
            <span className="flex-none text-[11.5px] text-slate-500">{status}</span>
        </Tag>
    );
}

export default function TagDetail({ result, onBack, onRaiseReprint }) {
    if (!result) return <ListBox className="mt-4"><EmptyState>Loading…</EmptyState></ListBox>;

    if (result.state === "SET") {
        const s = result.set;
        return (
            <Card>
                <DetailHead code={s.shortCode} kind="SET" onBack={onBack} />
                <Body preview={<TagPreviewLabel shortCode={s.shortCode} kind="SET" designCode={s.design.code} designName={s.design.name} colorName={s.variant.colorName} mrp={s.mrp} inwardDate={s.inwardDate} />}>
                    <Title>{s.design.code} · {s.variant.colorName}</Title>
                    <Meta>{s.pieceCount}-piece set ({s.sizeLabels?.join(" · ")}){s.rack ? ` · rack ${s.rack.code}` : ""}</Meta>
                    <FieldGrid>
                        <Field k="Set MRP" v={s.mrp != null ? `₹ ${s.mrp}` : "—"} />
                        <Field k="Inward batch" v={s.inwardBatch ?? "—"} sm />
                        <Field k="Inward date" v={s.inwardDate ?? "—"} sm />
                        <Field k="Times printed" v={`${s.timesPrinted ?? 0} ×`} />
                        <Field k="Last printed" v={s.lastPrintedAt ? new Date(s.lastPrintedAt).toLocaleString() : "—"} sm />
                        <Field k="Sealed" v={`${s.sealedDays} d ago`} />
                    </FieldGrid>
                </Body>
                <Actions>
                    <ActionButton variant="primary" onClick={() => onRaiseReprint([{ stockItemId: s.stockItemId, shortCode: s.shortCode, kind: "SET", designCode: s.design.code, designName: s.design.name, colorName: s.variant.colorName }])}>Reprint this tag</ActionButton>
                </Actions>
            </Card>
        );
    }

    if (result.state === "PIECE") {
        const p = result.piece;
        return (
            <Card>
                <DetailHead code={p.shortCode} kind="PIECE" onBack={onBack} />
                <Body preview={<TagPreviewLabel shortCode={p.shortCode} kind="PIECE" designCode={p.design.code} designName={p.design.name} colorName={p.variant.colorName} sizeLabel={p.sizeLabel} parentShortCode={p.parent?.shortCode} inwardDate={p.inwardDate} />}>
                    <Title>{p.design.code} · {p.variant.colorName}</Title>
                    <Meta>Child piece · size {p.sizeLabel ?? "—"}{p.bin ? ` · bin ${p.bin.code}` : ""}</Meta>
                    <FieldGrid>
                        <Field k="Inward batch" v={p.inwardBatch ?? "—"} sm />
                        <Field k="Inward date" v={p.inwardDate ?? "—"} sm />
                        <Field k="Times printed" v={`${p.timesPrinted ?? 0} ×`} />
                        <Field k="Last printed" v={p.lastPrintedAt ? new Date(p.lastPrintedAt).toLocaleString() : "—"} sm />
                        <Field k="Origin" v={p.origin === "SET_BREAK" ? "From a broken set" : "Loose received"} sm />
                        <Field k="Parent set" v={p.parent?.shortCode ?? "—"} sm />
                    </FieldGrid>
                </Body>
                <Actions>
                    <ActionButton variant="primary" onClick={() => onRaiseReprint([{ stockItemId: p.stockItemId, shortCode: p.shortCode, kind: "PIECE", designCode: p.design.code, designName: p.design.name, colorName: p.variant.colorName, sizeLabel: p.sizeLabel }])}>Reprint this tag</ActionButton>
                    {p.parent?.shortCode && <ActionButton onClick={() => onBack(p.parent.shortCode)}>View parent set</ActionButton>}
                </Actions>
            </Card>
        );
    }

    if (result.state === "RETIRED") {
        const r = result.retired;
        return (
            <Card tone="blue">
                <DetailHead code={r.shortCode} kind="RETIRED" tone="blue" onBack={onBack} />
                <InfoNote className="border-t-0">
                    <b>Retired {r.retiredAt ? new Date(r.retiredAt).toLocaleString() : ""}{r.retiredReason ? ` — ${r.retiredReason}` : " — no reason recorded"}.</b> Its pieces carry their own tags now.
                </InfoNote>
                {r.successors?.length > 0 && (
                    <ChildRows className="mt-3.5 sm:mt-5">
                        {r.successors.map((succ) => (
                            <ChildRow key={succ.shortCode} as="button" type="button" onClick={() => onBack(succ.shortCode)} label={succ.shortCode} status={succ.sizeLabel ?? ""} />
                        ))}
                    </ChildRows>
                )}
            </Card>
        );
    }

    if (result.state === "DUPLICATE") {
        const d = result.duplicate;
        return (
            <Card>
                <DetailHead code={d.shortCode} kind="DUPLICATE" onBack={onBack} />
                <InfoNote className="border-t-0">
                    <b>{d.events.length} active stock items currently share this code.</b> This needs manual reconciliation before either can be trusted at the till.
                </InfoNote>
                <ChildRows className="mt-3.5 sm:mt-5">
                    {d.events.map((ev, i) => (
                        <ChildRow
                            key={`${ev.stockItemId}-${i}`}
                            label={`stock item #${ev.stockItemId}`}
                            status={`${ev.printerName ?? "—"} · ${ev.printedAt ? new Date(ev.printedAt).toLocaleString() : "never printed"}`}
                        />
                    ))}
                </ChildRows>
            </Card>
        );
    }

    if (result.state === "RACK") {
        const r = result.rack;
        return (
            <Card>
                <DetailHead code={r.code} onBack={onBack} />
                <Body>
                    <Title>Rack {r.code}</Title>
                    <FieldGrid>
                        <Field k="Expected sets" v={r.expectedSets} />
                        <Field k="Scanned sets" v={r.scannedSets} />
                        <Field k="Missing" v={r.missing} />
                    </FieldGrid>
                    {r.breakdown?.length > 0 && (
                        <ChildRows className="mx-0 mt-4 mb-0 sm:mx-0 sm:mb-0">
                            {r.breakdown.map((b, i) => (
                                <ChildRow key={i} label={`${b.designCode} · ${b.colorName}`} status={`${b.sets} sets`} />
                            ))}
                        </ChildRows>
                    )}
                </Body>
            </Card>
        );
    }

    // UNKNOWN
    return (
        <ListBox className="mt-4">
            <EmptyState title="Unrecognized code">
                <span className="font-mono">{result.code}</span> doesn't match any tag on file.
            </EmptyState>
        </ListBox>
    );
}
