import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { ActionButton } from "../shared/primitives.jsx";

// Generic slide-in drawer shell, ported from the reference mockup's .scrim/.drawer behavior —
// no equivalent existed in the app's shared components, so this is net new.
export default function Drawer({ open, onClose, title, subtitle, children, footer, wide = false }) {
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    return (
        <>
            <div
                onClick={onClose}
                className={cn(
                    "fixed inset-0 z-40 bg-slate-900/40 transition-opacity duration-150 motion-reduce:transition-none dark:bg-black/60",
                    open ? "opacity-100" : "pointer-events-none opacity-0",
                )}
            />
            <aside
                role="dialog"
                aria-label={title}
                className={cn(
                    "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white text-sm text-slate-900 shadow-[-10px_0_40px_rgba(15,23,42,.14)] transition-transform duration-200 ease-[cubic-bezier(.3,.7,.3,1)] motion-reduce:transition-none dark:shadow-[-10px_0_40px_rgba(0,0,0,.5)]",
                    wide ? "max-w-none lg:w-[min(1180px,94vw)]" : "max-w-[580px]",
                    open ? "translate-x-0" : "translate-x-full",
                )}
            >
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 sm:px-6 sm:py-5">
                    <div>
                        <h3 className="mb-0.5 text-lg font-bold tracking-[-.01em]">{title}</h3>
                        <div className="font-mono text-[13px] text-slate-500">{subtitle}</div>
                    </div>
                    <ActionButton size="sm" onClick={onClose}>Close</ActionButton>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-[18px] sm:px-6 sm:py-[22px]">{children}</div>
                {/* Phone: summary on its own line, buttons share the row below it. */}
                <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-4 pt-3.5 pb-[calc(14px+env(safe-area-inset-bottom))] sm:px-6 sm:py-4 [&>button]:flex-1 sm:[&>button]:flex-none">
                    {footer}
                </div>
            </aside>
        </>
    );
}

// Left-hand summary in a drawer footer ("3 tags to print").
export const DrawerSummary = ({ count, children }) => (
    <span className="basis-full text-[12.8px] text-slate-500 sm:mr-auto sm:basis-auto">
        <b className="font-mono text-slate-900">{count}</b> {children}
    </span>
);
