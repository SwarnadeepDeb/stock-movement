import { useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useDesignSearchApi } from "./useSalesApi.js";
import { Kbd } from "../components/ScanPanel.jsx";
import { DesignFinderResults } from "../components/DesignFinder.jsx";

// Typed-but-not-yet-added quantities: designId -> { colorVariantId -> text }.
export function useQuantityDrafts() {
    const [drafts, setDrafts] = useState({});

    return {
        drafts,
        setDraft: (designId, variantId, value) =>
            setDrafts((previous) => ({ ...previous, [designId]: { ...previous[designId], [variantId]: value } })),
        clearDesign: (designId) =>
            setDrafts((previous) => {
                const next = { ...previous };
                delete next[designId];
                return next;
            }),
    };
}

// The order form's "Add designs" box. Type a design code, an item / pattern / quality / colour
// word, or a hanging tag's ID; the matching designs list on the left and the highlighted one's
// colours open on the right, ready for pieces. ↑ / ↓ choose a design, Enter jumps to the
// quantities, and Enter again adds them to the order.
//
// `lines` are the order's current lines; `onCommit(design, quantities)` applies the typed pieces
// (colorVariantId -> count, zero meaning "take this colour off"). `scanRef` is the ScanPanel, so
// focus can return to the search box once a design has been added. Returns the `live` props the
// ScanPanel's Manual mode takes.
export function useDesignFinder({ lines, onCommit, scanRef }) {
    const [query, setQuery] = useState("");
    const [pick, setPick] = useState({ key: "", id: null });
    const { drafts, setDraft, clearDesign } = useQuantityDrafts();
    const paneRef = useRef(null);

    const debounced = useDebouncedValue(query, 200).trim();
    const { data, isPlaceholderData, isFetching } = useDesignSearchApi(debounced);
    const { data: quick } = useDesignSearchApi("");

    const designs = query.trim() ? (data?.data ?? []) : [];

    // Which design's colours are open: whatever the user last chose for this search, else the one
    // a typed tag / colour code names outright, else the one chosen before, else the best match.
    const chosen = (pick.key === debounced && designs.find((design) => design.designId === pick.id))
        || (designs[0]?.exactMatch ? designs[0] : null)
        || designs.find((design) => design.designId === pick.id)
        || designs[0]
        || null;

    const select = (design) => setPick({ key: debounced, id: design.designId });

    // Choosing a design by click should also put the cursor in its quantities, but its pane only
    // exists after the next render — so note the wish and carry it out once the pane is there.
    const focusAfterRender = useRef(false);
    useEffect(() => {
        if (!focusAfterRender.current || !paneRef.current) return;

        focusAfterRender.current = false;
        paneRef.current.focusQty(chosen?.focusColorVariantId);
    });

    const choose = (design) => {
        if (design.designId === chosen?.designId) {
            paneRef.current?.focusQty(design.focusColorVariantId);
            return;
        }

        focusAfterRender.current = true;
        select(design);
    };

    const commit = (design, quantities) => {
        onCommit(design, quantities);
        clearDesign(design.designId);
        setQuery("");
        scanRef.current?.focus();
    };

    const onKeyDown = (event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            if (designs.length === 0) return;
            event.preventDefault();
            const at = designs.findIndex((design) => design.designId === chosen?.designId);
            select(designs[Math.min(designs.length - 1, Math.max(0, at + (event.key === "ArrowDown" ? 1 : -1)))]);
        } else if (event.key === "Enter") {
            event.preventDefault();
            if (chosen) paneRef.current?.focusQty(chosen.focusColorVariantId);
        } else if (event.key === "Escape" && query) {
            event.preventDefault();
            event.stopPropagation();
            setQuery("");
        }
    };

    return {
        value: query,
        onChange: setQuery,
        onKeyDown,
        placeholder: "Type a design code or name — e.g. KP100, FL2, Anarkali or “kp100 pink”",
        hint: (
            <>
                <Kbd>↑</Kbd><Kbd>↓</Kbd> move between designs · <Kbd>Enter</Kbd> type quantities · <Kbd>Enter</Kbd> again adds to the order. Tag IDs work here too.
            </>
        ),
        results: (
            <DesignFinderResults
                query={query}
                searching={debounced !== query.trim() || (isFetching && designs.length === 0)}
                noMatch={debounced === query.trim() && !isPlaceholderData && designs.length === 0 && Boolean(data)}
                quickPicks={quick?.data ?? []}
                designs={designs}
                chosen={chosen}
                lines={lines}
                drafts={drafts}
                paneRef={paneRef}
                onSelect={choose}
                onQuickPick={(code) => { setQuery(code); scanRef.current?.focus(); }}
                onDraft={setDraft}
                onCommit={commit}
                onEscape={() => scanRef.current?.focus()}
            />
        ),
    };
}
