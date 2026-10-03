import { useMemo, useRef, useState } from "react";
import { Check, Pencil, Plus } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePartiesApi } from "../hooks/usePartiesApi.js";

const FIELDS = [
    { key: "name", label: "Party name", required: true },
    { key: "mobile", label: "Mobile" },
    { key: "city", label: "City" },
    { key: "gst", label: "GST No." },
    { key: "transport", label: "Transport" },
    { key: "agent", label: "Agent" },
];

const TRACKED = FIELDS.map((field) => field.key);

export const EMPTY_PARTY_FIELDS = { name: "", mobile: "", city: "", gst: "", transport: "", agent: "" };

// Renders the six party fields with an autocomplete on the name. `value` is the full field set,
// `linkedParty` is the Party Master record it was filled from (null for a new party), and the
// parent owns both — so a document can save the fields it shows while deciding separately
// whether to write them back to Party Master.
//
// Built in slice 1 alongside the API it depends on; consumed by Order Forms and Invoices.
const PartyPicker = ({ value, onChange, linkedParty, onLink }) => {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [highlighted, setHighlighted] = useState(-1);
    const blurTimer = useRef(null);

    const debouncedQuery = useDebouncedValue(query, 250);
    const { data: response } = usePartiesApi({ page: 1, limit: 6, q: debouncedQuery });
    const matches = response?.data ?? [];

    const changedFields = useMemo(() => {
        if (!linkedParty) return [];
        return TRACKED.filter((key) => (linkedParty[key] ?? "") !== (value[key] ?? ""));
    }, [linkedParty, value]);

    const setField = (key) => (event) => {
        const next = { ...value, [key]: event.target.value };
        onChange(next);

        if (key === "name") {
            setQuery(event.target.value);
            setOpen(true);
            setHighlighted(-1);
            // Typing a different name means this is no longer the linked party.
            const typed = event.target.value.trim().toLowerCase();
            if (linkedParty && linkedParty.name.trim().toLowerCase() !== typed) onLink(null);
        }
    };

    const select = (partyRecord) => {
        onChange(TRACKED.reduce((accumulator, key) => ({ ...accumulator, [key]: partyRecord[key] ?? "" }), {}));
        onLink(partyRecord);
        setOpen(false);
        setHighlighted(-1);
    };

    const handleKeyDown = (event) => {
        if (!open || matches.length === 0) return;

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlighted((index) => Math.min(index + 1, matches.length - 1));
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlighted((index) => Math.max(index - 1, 0));
        } else if (event.key === "Enter" && highlighted >= 0) {
            event.preventDefault();
            select(matches[highlighted]);
        } else if (event.key === "Escape") {
            setOpen(false);
        }
    };

    const badge = (() => {
        if (!value.name?.trim()) return null;
        if (!linkedParty) {
            return { tone: "bg-blue-50 text-blue-700 border-blue-200", Icon: Plus, text: "New party — will be added to Party Master" };
        }
        if (changedFields.length > 0) {
            return {
                tone: "bg-amber-50 text-amber-700 border-amber-200",
                Icon: Pencil,
                text: `${changedFields.length} field${changedFields.length === 1 ? "" : "s"} changed from Party Master`,
            };
        }
        return { tone: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: Check, text: "Filled from Party Master" };
    })();

    return (
        <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-base font-bold text-[#1E1B4B]">Party details</h2>
                </div>
                {badge && (
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${badge.tone}`}>
                        <badge.Icon className="h-3.5 w-3.5" /> {badge.text}
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {FIELDS.map((field) => (
                    <div key={field.key} className="relative">
                        <label className="mb-1.5 block text-xs font-semibold text-[#1E1B4B]" htmlFor={`picker-${field.key}`}>
                            {field.label}
                            {field.required && <span className="text-red-600"> *</span>}
                        </label>
                        <input
                            id={`picker-${field.key}`}
                            className="pill-input"
                            autoComplete="off"
                            value={value[field.key] ?? ""}
                            onChange={setField(field.key)}
                            onKeyDown={field.key === "name" ? handleKeyDown : undefined}
                            onFocus={field.key === "name"
                                ? () => { clearTimeout(blurTimer.current); setOpen(true); }
                                : undefined}
                            onBlur={field.key === "name"
                                ? () => { blurTimer.current = setTimeout(() => setOpen(false), 120); }
                                : undefined}
                            placeholder={field.key === "name" ? "Start typing party name or mobile" : undefined}
                        />

                        {field.key === "name" && open && matches.length > 0 && (
                            <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                                {matches.map((match, index) => (
                                    <button
                                        key={match.id}
                                        type="button"
                                        className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3.5 py-2.5 text-left last:border-b-0 ${index === highlighted ? "bg-emerald-50" : "hover:bg-emerald-50"}`}
                                        onMouseDown={(event) => { event.preventDefault(); select(match); }}
                                    >
                                        <span>
                                            <span className="block text-sm font-semibold text-[#1E1B4B]">{match.name}</span>
                                            <span className="block text-xs text-slate-500">
                                                {[match.city, match.mobile].filter(Boolean).join(" · ") || "No contact details"}
                                            </span>
                                        </span>
                                        <span className="font-mono text-xs text-slate-400">{match.gst}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PartyPicker;
