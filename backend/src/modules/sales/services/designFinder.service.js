import { db } from "../../../database/index.js";

import designFinderRepository from "../repositories/designFinder.repository.js";
import variantInventoryRepository from "../../inventory/repositories/variantInventory.repository.js";
import scanResolverService from "./scanResolver.service.js";

const CANDIDATE_LIMIT = 60;
const RESULT_LIMIT = 20;
const QUICK_PICK_LIMIT = 8;

// "KP-100 / mid" and "kp100mid" are the same thing to someone typing quickly at the counter.
const compact = (value) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const words = (text) => String(text ?? "").toLowerCase().split(/[\s,]+/).filter(Boolean);

// The design finder behind the order form's "Add designs" box. One call turns whatever was typed
// (a design code, an item or pattern name, a quality, a colour, a hanging tag's ID, or a colour
// code like KP100-MID) into designs with their colours, live stock and set size, so the screen can
// show the colours and take pieces per colour without further round trips.
class DesignFinderService {
    _repository = designFinderRepository;
    _variantInventoryRepository = variantInventoryRepository;
    _scanResolver = scanResolverService;

    // Every colour of the given designs, in the shape the screens use. Stock is the variant's total
    // physical pieces; `setPieces` is how many pieces one complete set of that colour holds.
    async _assemble(designRows, { focus = new Map() } = {}) {
        const designIds = designRows.map((row) => row.designId);
        const variants = await this._repository.findActiveVariantsByDesignIds(db, designIds);
        const variantIds = variants.map((variant) => variant.colorVariantId);

        const [totals, setSizes] = await Promise.all([
            variantIds.length ? this._variantInventoryRepository.sumQuantityByColorVariantIds(variantIds) : [],
            this._repository.findSetSizesByVariantIds(db, variantIds),
        ]);

        const stockByVariant = new Map(totals.map((row) => [row.colorVariantId, row.totalPieces]));
        const setSizesByVariant = new Map();
        for (const size of setSizes) {
            const list = setSizesByVariant.get(size.variantId) ?? [];
            list.push(size.sizeLabel);
            setSizesByVariant.set(size.variantId, list);
        }

        const variantsByDesign = new Map();
        for (const variant of variants) {
            const list = variantsByDesign.get(variant.designId) ?? [];
            list.push({
                colorVariantId: variant.colorVariantId,
                colorName: variant.colorName,
                colorHex: variant.colorHex,
                imageUrl: variant.imageUrl,
                availablePcs: stockByVariant.get(variant.colorVariantId) ?? 0,
                setPieces: setSizesByVariant.get(variant.colorVariantId)?.length ?? 0,
            });
            variantsByDesign.set(variant.designId, list);
        }

        return designRows.map((row) => {
            const colours = variantsByDesign.get(row.designId) ?? [];
            const setSizeLabels = setSizesByVariant.get(colours[0]?.colorVariantId) ?? [];

            return {
                designId: row.designId,
                designCode: row.designCode,
                // `designName` stays what it always was on this API (the pattern) so existing
                // callers keep working; `pattern` and `itemName` name the two things apart.
                designName: row.pattern,
                pattern: row.pattern,
                itemName: row.itemName ?? null,
                quality: row.quality ?? null,
                unitPrice: Number(row.unitPrice ?? 0),
                setSizes: setSizeLabels,
                totalAvailablePcs: colours.reduce((sum, colour) => sum + colour.availablePcs, 0),
                exactMatch: false,
                focusColorVariantId: focus.get(row.designId) ?? null,
                variants: colours,
            };
        });
    }

    async byId(designId, { focusColorVariantId } = {}) {
        const rows = await this._repository.findByIds(db, [Number(designId)]);
        const focus = new Map(focusColorVariantId ? [[Number(designId), focusColorVariantId]] : []);

        return (await this._assemble(rows, { focus }))[0] ?? null;
    }

    // Designs to offer before anything is typed.
    async quickPick() {
        const rows = await this._repository.findCandidates(db, { tokens: [], limit: QUICK_PICK_LIMIT });

        return this._assemble(rows);
    }

    // A hanging tag's ID, or "KP100-MID" (design code + the first letters of a colour), names one
    // design and one colour exactly. Returns { designId, colorVariantId } or null.
    async _exactTarget(raw) {
        // A set whose composition was never recorded makes the resolver throw; for a search box
        // that is just "not a tag", not an error.
        const resolved = await this._scanResolver.resolve(raw).catch(() => null);
        if (resolved?.state === "OK") {
            return { designId: resolved.designId, colorVariantId: resolved.colorVariantId };
        }

        const match = /^(.+?)-([A-Za-z]{2,4})$/.exec(raw);
        if (!match) return null;

        const codeRows = await this._repository.findCandidates(db, { tokens: [match[1]], limit: CANDIDATE_LIMIT });
        const designRow = codeRows.find((row) => compact(row.designCode) === compact(match[1]));
        if (!designRow) return null;

        const [assembled] = await this._assemble([designRow]);
        const letters = match[2].toUpperCase();
        const colour = assembled.variants.find((variant) => compact(variant.colorName).startsWith(letters));

        return colour ? { designId: designRow.designId, colorVariantId: colour.colorVariantId } : null;
    }

    // Best match first: the tag's own design, then the design whose code was typed, then code
    // prefixes and substrings, then name / pattern / quality / colour matches.
    _score(row, colours, { raw, tokens, forcedDesignId }) {
        const key = compact(raw);
        const code = compact(row.designCode);
        const haystack = [row.itemName, row.pattern, row.quality, ...colours.map((colour) => colour.colorName)].join(" ").toLowerCase();

        if (row.designId === forcedDesignId) return 10;
        if (key && code.startsWith(key)) return 6;

        const prefixed = tokens.some((token) => compact(token) && code.startsWith(compact(token)));
        const allMatch = tokens.every((token) => (compact(token) && code.startsWith(compact(token))) || haystack.includes(token));
        if (prefixed && allMatch) return 5;
        if (key.length > 1 && code.includes(key)) return 3;
        if (tokens.every((token) => haystack.includes(token) || code.includes(compact(token)))) return 1;

        return 0;
    }

    // The colour to highlight in a design's pane: the tag's own colour, or a colour word typed
    // alongside the code ("kp100 pink").
    _focusFor(colours, { target, tokens }, designId) {
        if (target?.designId === designId) return target.colorVariantId;

        const colourWords = tokens.filter((token) => token.length >= 3 && !/\d/.test(token));
        const named = colours.find((colour) => colourWords.some((word) => colour.colorName.toLowerCase().includes(word)));

        return named?.colorVariantId ?? null;
    }

    async search(query) {
        const raw = String(query ?? "").trim();
        if (!raw) return this.quickPick();

        const tokens = words(raw);
        const target = await this._exactTarget(raw);

        const found = await this._repository.findCandidates(db, { tokens, limit: CANDIDATE_LIMIT });
        const rows = target && !found.some((row) => row.designId === target.designId)
            ? [...(await this._repository.findByIds(db, [target.designId])), ...found]
            : found;

        const assembled = await this._assemble(rows);

        return assembled
            .map((entry) => {
                const score = this._score(entry, entry.variants, { raw, tokens, forcedDesignId: target?.designId });
                return { entry, score };
            })
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score || a.entry.designCode.localeCompare(b.entry.designCode))
            .slice(0, RESULT_LIMIT)
            .map(({ entry }) => ({
                ...entry,
                // True when what was typed names this exact design (a tag ID or a colour code), so
                // the screen opens it straight away instead of leaving the choice to the user.
                exactMatch: target?.designId === entry.designId,
                focusColorVariantId: this._focusFor(entry.variants, { target, tokens }, entry.designId),
            }));
    }
}

export default new DesignFinderService();
