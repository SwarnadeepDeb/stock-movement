import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { checkScanApi } from "../services/invoice.api.js";
import { Kbd } from "../components/ScanPanel.jsx";
import TagFinderResult from "../components/TagFinderResult.jsx";

// The invoice's manual box, for tags that won't scan. The worker types the complete ID printed on
// the tag; once it matches, the tag appears with its status, and Enter (or a click) adds it. A
// partly typed ID shows nothing — the screen suggests no tags, so nothing wrong can be picked.
//
// `picked` are the tags already on the invoice (so a repeat reads "Added"), `onAdd(result)` takes a
// tag that can be billed, and `onRaw(text)` is what Enter does when nothing matched, so the
// operator still gets told why.
export function useTagFinder({ picked, invoiceId, orderForm, pickedFor, onAdd, onRaw, scanRef }) {
    const [value, setValue] = useState("");

    const typed = value.trim();
    const code = useDebouncedValue(typed, 250);
    const scanned = picked.map((item) => item.scanCode);

    const { data } = useQuery({
        queryKey: ["sales-scan-check", code, scanned.join(","), invoiceId ?? null],
        queryFn: () => checkScanApi({ code, scanned, invoiceId }),
        enabled: code.length >= 3,
        retry: false,
        staleTime: 0,
    });

    // Only an answer for exactly what is in the box counts — never one for an earlier keystroke.
    const result = code === typed && code.length >= 3 ? data?.data ?? null : null;
    const addable = result?.state === "OK" ? result : null;

    const add = (tag) => {
        onAdd(tag);
        setValue("");
        scanRef.current?.focus();
    };

    const onKeyDown = (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            if (!typed) return;

            if (addable) add(addable);
            else {
                onRaw(typed);
                setValue("");
            }
        } else if (event.key === "Escape" && value) {
            event.preventDefault();
            event.stopPropagation();
            setValue("");
        }
    };

    return {
        value,
        onChange: setValue,
        onKeyDown,
        upper: true,
        placeholder: "Type the full tag ID, e.g. SET-KP100-BLU-002",
        hint: (
            <>
                For tags that won&rsquo;t scan. Type the complete ID printed on the tag — it appears below once it matches. <Kbd>Enter</Kbd> or click adds it.
            </>
        ),
        results: <TagFinderResult result={result} orderForm={orderForm} pickedFor={pickedFor} onAdd={add} />,
    };
}
