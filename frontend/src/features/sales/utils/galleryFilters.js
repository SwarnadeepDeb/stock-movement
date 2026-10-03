// Gallery filters — design, item name, pattern, quality, search and (All designs only) stock.
// Everything runs on the client over the items already fetched, so every facet can show a live
// count of what each option would leave on screen given the other filters.

const EMPTY = "—";

// `value` is what a filter stores and matches on; `label` is what the option and its chip read.
// Designs key on designId, not code: a code is only unique within a pattern, so "FL2" can be two
// different designs, and ticking one must not pull in the other.
export const FACETS = [
    { id: "designs", label: "Designs", chip: "Design", value: (item) => item.designId, text: (item) => item.designCode },
    { id: "items", label: "Item name", chip: "Item", value: (item) => item.itemName || EMPTY, text: (item) => item.itemName || EMPTY },
    // designName is the pattern's name (see design.schema.js).
    { id: "patterns", label: "Pattern", chip: "Pattern", value: (item) => item.designName || EMPTY, text: (item) => item.designName || EMPTY },
    { id: "qualities", label: "Quality", chip: "Quality", value: (item) => item.quality || EMPTY, text: (item) => item.quality || EMPTY },
];

export const STOCK_OPTIONS = [["all", "All"], ["in", "In stock"], ["out", "Out of stock"]];

export const freshFilters = () => ({ q: "", designs: [], items: [], patterns: [], qualities: [], pmin: "", pmax: "", stock: "all" });

// Price range (per piece). Empty string = no bound. A min above the max applies nothing and is flagged.
export const hasPrice = (filters) => filters.pmin !== "" || filters.pmax !== "";
export const priceBad = (filters) => filters.pmin !== "" && filters.pmax !== "" && Number(filters.pmin) > Number(filters.pmax);
export const priceLabel = (filters) => {
    const { pmin, pmax } = filters;
    if (pmin !== "" && pmax !== "") return `₹${pmin} – ₹${pmax}`;
    return pmin !== "" ? `₹${pmin} and above` : `Up to ₹${pmax}`;
};

// Design codes compare without case, spaces or hyphens: "fl 2" == "FL-2" == "FL2".
export const codeKey = (value) => String(value ?? "").toLowerCase().replace(/[\s-]/g, "");

// Builds the predicate for one render. Typed text counts as a design code when it is the start of
// at least one code on screen — then only codes starting with it match ("FL" → FL1, FL2…), rather
// than every design whose name or colour happens to contain "fl".
export function createMatcher(items, filters, mode) {
    const q = filters.q.trim().toLowerCase();
    const qKey = codeKey(q);
    const searchByCode = Boolean(qKey) && items.some((item) => codeKey(item.designCode).startsWith(qKey));

    return (item, except) => {
        for (const facet of FACETS) {
            const chosen = filters[facet.id];
            if (facet.id !== except && chosen.length && !chosen.includes(facet.value(item))) return false;
        }

        if (except !== "price" && !priceBad(filters)) {
            const price = Number(item.unitPrice ?? 0);
            if (filters.pmin !== "" && price < Number(filters.pmin)) return false;
            if (filters.pmax !== "" && price > Number(filters.pmax)) return false;
        }

        if (mode === "all") {
            if (filters.stock === "in" && !item.availablePcs) return false;
            if (filters.stock === "out" && item.availablePcs) return false;
        }

        if (q) {
            if (searchByCode) return codeKey(item.designCode).startsWith(qKey);

            const haystack = [item.designCode, item.itemName, item.designName, item.quality, item.colorName].join(" ").toLowerCase();
            if (!haystack.includes(q)) return false;
        }

        return true;
    };
}

// One facet's options, each with how many items it would show given every *other* filter.
// Options with nothing left are dropped, unless already ticked (so they can still be unticked).
export function facetOptions(items, filters, facetId, matches) {
    const facet = FACETS.find((candidate) => candidate.id === facetId);
    const options = new Map();

    for (const item of items) {
        const value = facet.value(item);
        const option = options.get(value) ?? { value, label: facet.text(item), pattern: item.designName, count: 0 };
        if (matches(item, facetId)) option.count += 1;
        options.set(value, option);
    }

    const list = [...options.values()].filter((option) => option.count || filters[facetId].includes(option.value));

    // A design code shared by two patterns gets its pattern alongside, so the two can be told apart.
    if (facetId === "designs") {
        const codeUses = new Map();
        for (const option of list) codeUses.set(codeKey(option.label), (codeUses.get(codeKey(option.label)) ?? 0) + 1);
        for (const option of list) option.hint = codeUses.get(codeKey(option.label)) > 1 ? option.pattern : null;
    }

    return list.sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { numeric: true })
        || String(a.hint ?? "").localeCompare(String(b.hint ?? "")));
}

// Removable chips for every active filter, in the order the controls appear.
export function activeChips(items, filters, mode) {
    const chips = [];

    for (const facet of FACETS) {
        for (const value of filters[facet.id]) {
            const item = items.find((candidate) => facet.value(candidate) === value);
            let text = item ? facet.text(item) : String(value);
            // Same disambiguation as the Designs list: a shared code names its pattern too.
            if (item && facet.id === "designs" && items.some((other) => other.designId !== item.designId && codeKey(other.designCode) === codeKey(item.designCode))) {
                text = `${text} (${item.designName})`;
            }
            chips.push({ kind: "facet", facetId: facet.id, value, label: `${facet.chip}: ${text}` });
        }
    }

    if (hasPrice(filters)) {
        chips.push({ kind: "price", bad: priceBad(filters), label: priceBad(filters) ? "Price: min is more than max" : `Price: ${priceLabel(filters)}` });
    }

    if (filters.q.trim()) chips.push({ kind: "search", label: `Search: “${filters.q.trim()}”` });
    if (mode === "all" && filters.stock !== "all") chips.push({ kind: "stock", label: filters.stock === "in" ? "In stock" : "Out of stock" });

    return chips;
}
