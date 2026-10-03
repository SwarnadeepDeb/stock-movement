import { useEffect, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";

// The number the user copies out of the physical book, checked for collisions as they type.
//
// Checking live matters because the alternative is discovering the clash at save time, after the
// whole document has been built — and the fix then is to retype a number that is already written
// on paper. `check` and `suggest` are injected so order forms and invoices share the behaviour
// without this component knowing which it is serving.
const DocumentNumberField = ({ label, value, onChange, placeholder, check, suggest, excludeId }) => {
    const [status, setStatus] = useState({ state: "idle" });
    const debounced = useDebouncedValue(value, 350);

    useEffect(() => {
        const trimmed = debounced.trim();

        if (!trimmed) {
            setStatus({ state: "idle" });
            return;
        }

        let cancelled = false;
        setStatus({ state: "checking" });

        check({ number: trimmed, excludeId })
            .then((response) => {
                if (cancelled) return;
                setStatus(response.data.available
                    ? { state: "ok", message: `${trimmed} is available.` }
                    : { state: "taken", message: `${trimmed} already exists — use a different number.` });
            })
            .catch(() => {
                // A failed check must not read as "available": that would invite a duplicate the
                // save then rejects. Say nothing and let the save decide.
                if (!cancelled) setStatus({ state: "idle" });
            });

        return () => { cancelled = true; };
    }, [debounced, excludeId, check]);

    const useSuggestion = async () => {
        const response = await suggest();
        onChange(response.data.formNumber ?? response.data.invoiceNumber);
    };

    return (
        <div className="w-full sm:w-64">
            <label className="mb-1.5 block text-xs font-semibold text-[#1E1B4B]" htmlFor="document-number">
                {label} <span className="text-red-600">*</span>
            </label>

            <div className="flex gap-2">
                <input
                    id="document-number"
                    className={cn(
                        "pill-input font-mono",
                        status.state === "taken" && "!border-red-500",
                        status.state === "ok" && "!border-emerald-500",
                    )}
                    value={value}
                    autoComplete="off"
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                />
                <button
                    type="button"
                    onClick={useSuggestion}
                    className="neu-button shrink-0 rounded-lg px-3 text-xs font-semibold text-[#1E1B4B]"
                    title="Use the next number in the series"
                >
                    Next no.
                </button>
            </div>

            <p className={cn(
                "mt-1.5 flex min-h-[18px] items-center gap-1 text-[11.5px]",
                status.state === "taken" ? "text-red-600" : status.state === "ok" ? "text-emerald-700" : "text-[#1E1B4B]/45",
            )}>
                {status.state === "taken" && <AlertTriangle className="h-3 w-3" />}
                {status.state === "ok" && <Check className="h-3 w-3" />}
                {status.message ?? "Type it exactly as written in your book."}
            </p>
        </div>
    );
};

export default DocumentNumberField;
