import { db } from "../../../database/index.js";
import ApiError from "../../../core/apiError.js";

import stockTransformationRepository from "../repositories/stockTransformation.repository.js";
import stockItemRepository from "../repositories/stockItem.repository.js";
import stockGroupRepository from "../repositories/stockGroup.repository.js";
import stockItemLineageRepository from "../repositories/stockItemLineage.repository.js";
import stockItemQrRepository from "../repositories/stockItemQr.repository.js";
import colorVariantRepository from "../../design/repositories/colorVariant.repository.js";
import designSizeRepository from "../../design/repositories/designSize.repository.js";
import stockQrService from "./stockQr.service.js";
import stockHistoryService from "./stockHistory.service.js";
import stockPieceExpansionService from "./stockPieceExpansion.service.js";
import displayCodeLookupService from "./displayCodeLookup.service.js";
import { buildBundleCompositionSignature, parseBundleCompositionSignature } from "./stockInPersistence.service.js";

// No auth module yet — every entry is attributed to this label until real users exist.
const DEFAULT_ACTOR = "Owner";
const LOG_LIMIT = 300;
const MAX_FORM_SUGGESTIONS_PER_VARIANT = 20;

// A piece out with someone is "overdue" after this many days. Display has no deadline.
export const OVERDUE_DAYS = { SALESPERSON: 7, SAMPLE: 10, ALTERATION: 5 };
// These need a name (who has the piece); DISPLAY and STOCK don't.
const HOLDER_REQUIRED = new Set(["SALESPERSON", "SAMPLE", "ALTERATION"]);

// --- snapshots (exact undo) ----------------------------------------------------------------

const iso = (value) => (value ? new Date(value).toISOString() : null);

function itemState(row) {
    return {
        status: row.status,
        parent: row.parentStockItemId ?? null,
        custody: row.custodyType,
        holder: row.custodyHolder ?? null,
        since: iso(row.custodySince),
    };
}

function qrState(row) {
    return { status: row.status, retiredAt: iso(row.retiredAt), retiredReason: row.retiredReason ?? null };
}

// Key-order-independent equality — snapshots round-trip through jsonb, which reorders keys.
function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (value && typeof value === "object") {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value ?? null);
}

function daysSince(value) {
    if (!value) return null;
    return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
}

function groupBy(rows, pick) {
    const map = new Map();
    for (const row of rows) {
        const key = pick(row);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(row);
    }
    return map;
}

class StockTransformationService {
    _repository = stockTransformationRepository;
    _stockItemRepository = stockItemRepository;
    _stockGroupRepository = stockGroupRepository;
    _stockItemLineageRepository = stockItemLineageRepository;
    _stockItemQrRepository = stockItemQrRepository;
    _colorVariantRepository = colorVariantRepository;
    _designSizeRepository = designSizeRepository;
    _stockQrService = stockQrService;
    _stockHistoryService = stockHistoryService;
    _stockPieceExpansionService = stockPieceExpansionService;
    _displayCodeLookup = displayCodeLookupService;

    // ==========================================================================================
    // Views
    // ==========================================================================================

    _pieceView(row, { unitCodes } = {}) {
        const inside = row.parentStockItemId !== null && row.parentStockItemId !== undefined;
        let state = "STOCK";
        if (row.status === "CONSUMED") state = "GONE";
        else if (inside) state = "INSIDE";
        else if (row.custodyType !== "STOCK") state = "OUT";

        const days = daysSince(row.custodySince);
        const limit = OVERDUE_DAYS[row.custodyType];
        return {
            stockItemId: row.stockItemId,
            code: row.shortCode ?? null,
            tagged: row.type === "PIECE",
            designSizeId: row.designSizeId,
            size: row.sizeLabel ?? "—",
            sizeOrder: row.sizeOrder ?? 0,
            colorVariantId: row.colorVariantId,
            design: { id: row.designId, code: row.designCode, name: row.designName },
            variant: { colorName: row.colorName, colorHex: row.colorHex },
            originUnitId: row.originSetStockItemId ?? null,
            originCode: row.originSetStockItemId ? (unitCodes?.get(row.originSetStockItemId) ?? null) : null,
            insideUnitId: inside ? row.parentStockItemId : null,
            insideCode: inside ? (unitCodes?.get(row.parentStockItemId) ?? null) : null,
            challanNo: row.challanNo ?? null,
            receivedOn: row.receivedOn,
            state,
            custody: {
                type: row.custodyType,
                holder: row.custodyHolder ?? null,
                since: row.custodySince,
                days,
                overdue: state === "OUT" && limit !== undefined && days !== null && days > limit,
            },
        };
    }

    async _setSizesByVariant(runner, variantIds) {
        const sizes = await this._designSizeRepository.findActiveByVariantIds(runner, variantIds);
        return groupBy(sizes.filter((size) => size.includedInSet), (size) => size.variantId);
    }

    // Everything the page shows outside the log tab, in one request.
    async getOverview() {
        const looseRows = await this._repository.findAllLoosePieces(db);
        const brokenIds = await this._repository.findTrackedBrokenUnitIds(db);
        const [bornInRows, brokenUnitRows] = await Promise.all([
            this._repository.findPiecesBornIn(db, brokenIds),
            this._repository.findItemViewsByIds(db, brokenIds),
        ]);

        const unitIdsToLabel = new Set(brokenIds);
        for (const row of [...looseRows, ...bornInRows]) {
            if (row.originSetStockItemId) unitIdsToLabel.add(row.originSetStockItemId);
            if (row.parentStockItemId) unitIdsToLabel.add(row.parentStockItemId);
        }
        const unitCodes = await this._repository.findLatestShortCodes(db, [...unitIdsToLabel]);

        const loose = looseRows.map((row) => this._pieceView(row, { unitCodes }));
        const variantIds = [...new Set(loose.map((piece) => piece.colorVariantId).concat(brokenUnitRows.map((row) => row.colorVariantId)))];
        const setSizesByVariant = await this._setSizesByVariant(db, variantIds);

        const brokenSets = await this._buildBrokenSets(brokenUnitRows, bornInRows, unitCodes);
        const suggestions = this._buildSuggestions(loose, brokenSets, setSizesByVariant);
        const piecesOut = loose.filter((piece) => piece.state === "OUT");

        const holders = await this._repository.findKnownHolders(db);
        const logCount = await this._repository.countEntries(db);
        const formable = suggestions.filter((item) => item.kind === "RESTORE" || item.kind === "FORM");

        return {
            stats: {
                looseInStock: loose.filter((piece) => piece.state === "STOCK" && setSizesByVariant.has(piece.colorVariantId)).length,
                piecesOut: piecesOut.length,
                piecesOverdue: piecesOut.filter((piece) => piece.custody.overdue).length,
                setsFormable: formable.length,
                setsRestorable: formable.filter((item) => item.kind === "RESTORE").length,
                brokenTracked: brokenSets.length,
                logEntries: logCount,
            },
            overdueDays: OVERDUE_DAYS,
            suggestions,
            brokenSets,
            piecesOut,
            holders: this._holderSuggestions(holders),
        };
    }

    _holderSuggestions(rows) {
        const byType = {};
        for (const row of rows) {
            if (!row.holder || !row.type) continue;
            (byType[row.type] ??= new Set()).add(row.holder);
        }
        return Object.fromEntries(Object.entries(byType).map(([type, names]) => [type, [...names].sort()]));
    }

    async _buildBrokenSets(unitRows, bornInRows, unitCodes) {
        const piecesByUnit = groupBy(bornInRows, (row) => row.originSetStockItemId);
        const breakEntries = await this._latestBreakEntries(unitRows.map((row) => row.stockItemId));

        return unitRows.map((unit) => {
            const pieces = (piecesByUnit.get(unit.stockItemId) ?? []).map((row) => this._pieceView(row, { unitCodes }));
            const back = pieces.filter((piece) => piece.state === "STOCK").length;
            const out = pieces.filter((piece) => piece.state === "OUT");
            const gone = pieces.filter((piece) => piece.state === "GONE" || piece.state === "INSIDE");
            const state = gone.length ? "CANT_RESTORE" : back === pieces.length ? "RESTORABLE" : "WAITING";
            const entry = breakEntries.get(unit.stockItemId);
            return {
                unit: {
                    stockItemId: unit.stockItemId,
                    code: unitCodes.get(unit.stockItemId) ?? null,
                    kind: unit.type === "SET" ? "SET" : "SEMI",
                },
                colorVariantId: unit.colorVariantId,
                design: { id: unit.designId, code: unit.designCode, name: unit.designName },
                variant: { colorName: unit.colorName, colorHex: unit.colorHex },
                brokenAt: entry?.createdAt ?? null,
                brokenBy: entry?.createdBy ?? null,
                reason: entry?.reason ?? null,
                note: entry?.note ?? null,
                pieces,
                backCount: back,
                outPieceIds: out.map((piece) => piece.stockItemId),
                state,
            };
        });
    }

    async _latestBreakEntries(unitIds) {
        if (unitIds.length === 0) return new Map();
        const rows = await this._repository.findEntries(db, { limit: 2000 });
        const map = new Map();
        for (const { entry } of rows) {
            if (entry.type === "BREAK" && !entry.undoneAt && unitIds.includes(entry.unitStockItemId) && !map.has(entry.unitStockItemId)) {
                map.set(entry.unitStockItemId, entry);
            }
        }
        return map;
    }

    // Best pieces for the given sizes: pieces born in the same original set first, then the
    // challan that covers the most sizes, then the oldest piece (FIFO). Returns null when any size
    // has no candidate.
    _bestPick(sizes, pool) {
        const bySize = new Map(sizes.map((size) => [size.id, pool.filter((piece) => piece.designSizeId === size.id)]));
        if (sizes.some((size) => bySize.get(size.id).length === 0)) return null;

        const origins = [...new Set(pool.map((piece) => piece.originUnitId).filter(Boolean))];
        for (const origin of origins) {
            const pick = sizes.map((size) => bySize.get(size.id).find((piece) => piece.originUnitId === origin));
            if (pick.every(Boolean)) return pick;
        }

        const challans = [...new Set(pool.map((piece) => piece.challanNo ?? ""))];
        let bestChallan = null;
        let bestCoverage = -1;
        for (const challan of challans) {
            const coverage = sizes.filter((size) => bySize.get(size.id).some((piece) => (piece.challanNo ?? "") === challan)).length;
            if (coverage > bestCoverage) {
                bestCoverage = coverage;
                bestChallan = challan;
            }
        }
        return sizes.map((size) => [...bySize.get(size.id)].sort((a, b) =>
            ((a.challanNo ?? "") === bestChallan ? 0 : 1) - ((b.challanNo ?? "") === bestChallan ? 0 : 1)
            || String(a.receivedOn).localeCompare(String(b.receivedOn))
            || a.stockItemId - b.stockItemId)[0]);
    }

    _buildSuggestions(loose, brokenSets, setSizesByVariant) {
        const suggestions = [];
        const byVariant = groupBy(loose, (piece) => piece.colorVariantId);

        for (const [colorVariantId, pieces] of byVariant) {
            const setSizes = (setSizesByVariant.get(colorVariantId) ?? []).map((size) => ({ id: size.id, label: size.sizeLabel }));
            if (setSizes.length < 2) continue;
            const sample = pieces[0];
            const identity = { colorVariantId, design: sample.design, variant: sample.variant };

            const inStock = pieces.filter((piece) => piece.state === "STOCK");
            const out = pieces.filter((piece) => piece.state === "OUT");
            const used = new Set();
            const available = () => inStock.filter((piece) => !used.has(piece.stockItemId));

            // A) every piece of a broken original is back on the shelf → restore it.
            for (const broken of brokenSets) {
                if (broken.colorVariantId !== colorVariantId || broken.state !== "RESTORABLE") continue;
                if (broken.pieces.some((piece) => used.has(piece.stockItemId))) continue;
                broken.pieces.forEach((piece) => used.add(piece.stockItemId));
                suggestions.push({
                    ...identity,
                    kind: "RESTORE",
                    formKind: broken.unit.kind,
                    unit: broken.unit,
                    slots: broken.pieces.map((piece) => ({ designSizeId: piece.designSizeId, size: piece.size, piece, recall: false })),
                    challans: [...new Set(broken.pieces.map((piece) => piece.challanNo).filter(Boolean))],
                    score: 100,
                });
            }

            // B) new complete sets from whatever loose pieces cover every size.
            for (let i = 0; i < MAX_FORM_SUGGESTIONS_PER_VARIANT; i++) {
                const pick = this._bestPick(setSizes, available());
                if (!pick) break;
                pick.forEach((piece) => used.add(piece.stockItemId));
                const challans = [...new Set(pick.map((piece) => piece.challanNo).filter(Boolean))];
                suggestions.push({
                    ...identity,
                    kind: "FORM",
                    formKind: "SET",
                    slots: pick.map((piece) => ({ designSizeId: piece.designSizeId, size: piece.size, piece, recall: false })),
                    challans,
                    score: challans.length <= 1 ? 80 : 70,
                });
            }

            // C/D) what's left: one or two sizes short — recall them if they're out, else semi set.
            const left = available();
            if (left.length === 0) continue;
            const present = setSizes.filter((size) => left.some((piece) => piece.designSizeId === size.id));
            const missing = setSizes.filter((size) => !present.includes(size));
            if (missing.length === 0) continue;

            const recall = missing.map((size) => out.find((piece) => piece.designSizeId === size.id && piece.tagged));
            if (missing.length <= 2 && recall.every(Boolean)) {
                const presentPick = this._bestPick(present, left) ?? [];
                suggestions.push({
                    ...identity,
                    kind: "RECALL",
                    formKind: "SET",
                    slots: setSizes.map((size) => {
                        const fromOut = recall.find((piece) => piece.designSizeId === size.id);
                        const piece = fromOut ?? presentPick.find((candidate) => candidate.designSizeId === size.id);
                        return { designSizeId: size.id, size: size.label, piece, recall: Boolean(fromOut) };
                    }),
                    recallPieceIds: recall.map((piece) => piece.stockItemId),
                    score: 50,
                });
            } else if (present.length >= 2 && !missing.some((size) => out.some((piece) => piece.designSizeId === size.id))) {
                const pick = this._bestPick(present, left);
                if (pick) {
                    suggestions.push({
                        ...identity,
                        kind: "SEMI",
                        formKind: "SEMI",
                        slots: pick.map((piece) => ({ designSizeId: piece.designSizeId, size: piece.size, piece, recall: false })),
                        missingSizes: missing.map((size) => size.label),
                        score: 20,
                    });
                }
            }
        }

        return suggestions.sort((a, b) => b.score - a.score);
    }

    // Loose pieces of one variant, for the Form flow's per-size pickers.
    async getVariantPool(colorVariantId) {
        const variant = await this._colorVariantRepository.findActiveById(db, colorVariantId);
        if (!variant) throw new ApiError(`Color variant ${colorVariantId} not found or inactive.`, 404, "VARIANT_NOT_FOUND");

        const [sizes, rows] = await Promise.all([
            this._designSizeRepository.findActiveByVariantId(db, colorVariantId),
            this._repository.findLoosePiecesForVariant(db, colorVariantId),
        ]);
        const unitIds = [...new Set(rows.flatMap((row) => [row.originSetStockItemId, row.parentStockItemId]).filter(Boolean))];
        const unitCodes = await this._repository.findLatestShortCodes(db, unitIds);

        return {
            colorVariantId,
            design: { id: variant.designId, code: variant.designCode, name: variant.designName },
            variant: { colorName: variant.colorName, colorHex: variant.colorHex },
            sizes: sizes.map((size) => ({ designSizeId: size.id, size: size.sizeLabel, includedInSet: size.includedInSet })),
            pieces: rows.map((row) => this._pieceView(row, { unitCodes })).filter((piece) => piece.state === "STOCK"),
        };
    }

    // A short code (or payload / "#id") first; failing that, the readable id printed on the label.
    // Two colours sharing a colour code make that id ambiguous, which reads as unknown here
    // rather than picking one.
    async _findItemIdByCode(code) {
        const id = await this._repository.findItemIdByCode(db, code);
        if (id) return id;

        const fromLabel = await this._displayCodeLookup.findStockItemIds(db, code);
        return fromLabel.length === 1 ? fromLabel[0] : null;
    }

    // A scanned parent tag, previewed before breaking: its pieces (existing child tags, or the
    // sizes that will get new tags when it's broken).
    async resolveUnit(code) {
        const id = await this._findItemIdByCode(code);
        const [unit] = id ? await this._repository.findItemViewsByIds(db, [id]) : [];
        if (!unit) throw new ApiError(`"${code}" isn't a known tag.`, 404, "TAG_NOT_FOUND");
        if (unit.type !== "SET" && unit.type !== "BUNDLE") {
            throw new ApiError(`"${code}" is a piece tag — scan the parent tag on the bundle.`, 400, "NOT_A_PARENT_TAG");
        }
        if (unit.status === "CONSUMED") throw new ApiError(`"${code}" is no longer in stock (already broken, sold or written off).`, 409, "UNIT_NOT_IN_STOCK");
        if (!unit.shortCode) throw new ApiError(`"${code}" has no active tag — it can't be broken here.`, 409, "NO_ACTIVE_TAG");

        const slots = await this._breakSlots(db, unit);
        return {
            unit: { stockItemId: unit.stockItemId, code: unit.shortCode, kind: unit.type === "SET" ? "SET" : "SEMI" },
            colorVariantId: unit.colorVariantId,
            design: { id: unit.designId, code: unit.designCode, name: unit.designName },
            variant: { colorName: unit.colorName, colorHex: unit.colorHex },
            slots: slots.map((slot) => ({ stockItemId: slot.stockItemId ?? null, code: slot.code ?? null, designSizeId: slot.designSizeId, size: slot.size })),
        };
    }

    // A scanned piece tag, for Move/Return.
    async resolvePiece(code) {
        const id = await this._findItemIdByCode(code);
        const [row] = id ? await this._repository.findItemViewsByIds(db, [id]) : [];
        if (!row) throw new ApiError(`"${code}" isn't a known tag.`, 404, "TAG_NOT_FOUND");
        if (row.type === "SET" || row.type === "BUNDLE") {
            throw new ApiError(`"${code}" is a parent tag — scan individual piece tags, or break the set first.`, 400, "NOT_A_PIECE_TAG");
        }
        if (row.type === "LOOSE_PIECE") throw new ApiError(`"${code}" is an untagged loose piece and can't be tracked out of stock.`, 400, "UNTAGGED_PIECE");
        const unitIds = [row.originSetStockItemId, row.parentStockItemId].filter(Boolean);
        const unitCodes = await this._repository.findLatestShortCodes(db, unitIds);
        const piece = this._pieceView(row, { unitCodes });
        if (piece.state === "GONE") throw new ApiError(`"${code}" is no longer in stock (sold or written off).`, 409, "PIECE_NOT_IN_STOCK");
        if (piece.state === "INSIDE") {
            throw new ApiError(`"${code}" is inside the set ${piece.insideCode ?? `#${piece.insideUnitId}`} — break that set first.`, 409, "PIECE_INSIDE_SET");
        }
        return piece;
    }

    // ==========================================================================================
    // BREAK
    // ==========================================================================================

    // The pieces a unit breaks into, in a stable order: its existing child tags if it has them
    // (Parent+Child tagging), otherwise one planned slot per physical piece of its composition.
    async _breakSlots(runner, unit) {
        const children = await this._repository.findChildrenInside(runner, unit.stockItemId);
        if (children.length > 0) {
            return children.map((child) => ({ stockItemId: child.stockItemId, code: child.shortCode, designSizeId: child.designSizeId, size: child.sizeLabel }));
        }
        const sizes = await this._designSizeRepository.findActiveByVariantId(runner, unit.colorVariantId);
        const byId = new Map(sizes.map((size) => [size.id, size]));
        let composition;
        if (unit.type === "SET") {
            composition = sizes.filter((size) => size.includedInSet).map((size) => ({ designSizeId: size.id, quantity: 1 }));
        } else {
            const group = await this._stockGroupRepository.findById(runner, unit.stockGroupId);
            composition = parseBundleCompositionSignature(group?.compositionSignature);
        }
        return composition.flatMap((piece) => Array.from({ length: piece.quantity }, () => {
            const size = byId.get(piece.designSizeId);
            return { designSizeId: piece.designSizeId, size: size?.sizeLabel ?? String(piece.designSizeId), unsetPricePerSize: size?.unsetPricePerSize ?? null };
        }));
    }

    async breakUnit({ unitStockItemId, destinations, reason, note }) {
        return db.transaction(async (tx) => {
            const [locked] = await this._repository.lockItems(tx, [unitStockItemId]);
            const [unit] = await this._repository.findItemViewsByIds(tx, [unitStockItemId]);
            if (!locked || !unit) throw new ApiError("Set not found.", 404, "UNIT_NOT_FOUND");
            if (unit.type !== "SET" && unit.type !== "BUNDLE") throw new ApiError("Only a set or semi set can be broken.", 400, "NOT_BREAKABLE");
            if (unit.status === "CONSUMED") throw new ApiError("This set is no longer in stock (already broken, sold or written off).", 409, "UNIT_NOT_IN_STOCK");

            const slots = await this._breakSlots(tx, unit);
            if (slots.length === 0) throw new ApiError("This set has no pieces to break into.", 400, "EMPTY_UNIT");
            // No destinations given (QR Center's quick break) = every piece back to stock.
            destinations = destinations ?? slots.map(() => ({ custodyType: "STOCK" }));
            if (destinations.length !== slots.length) {
                throw new ApiError(`Expected a destination for each of the ${slots.length} pieces.`, 400, "DESTINATION_COUNT_MISMATCH");
            }
            this._validateDestinations(destinations);

            const existingChildIds = slots.map((slot) => slot.stockItemId).filter(Boolean);
            if (existingChildIds.length) await this._repository.lockItems(tx, existingChildIds);
            const before = await this._snapshot(tx, [unitStockItemId, ...existingChildIds]);

            // Pieces without their own tag yet get one now, loose (not inside the set).
            let pieceIds = existingChildIds;
            let createdItemIds = [];
            let createdQrIds = [];
            if (existingChildIds.length === 0) {
                const created = await this._stockPieceExpansionService.createPiecesForComposition(tx, {
                    colorVariantId: unit.colorVariantId,
                    sizeEntries: slots.map((slot) => ({ designSizeId: slot.designSizeId, sizeLabel: slot.size, unsetPricePerSize: slot.unsetPricePerSize })),
                    originSetStockItemId: unitStockItemId,
                    insideParent: false,
                    designCode: unit.designCode,
                    designName: unit.designName,
                    colorName: unit.colorName,
                });
                pieceIds = created.map((row) => row.stockItem.id);
                createdItemIds = pieceIds;
                createdQrIds = created.map((row) => row.qr.id);
            }

            const now = new Date();
            for (let i = 0; i < pieceIds.length; i++) {
                const destination = destinations[i];
                await this._repository.updateItem(tx, pieceIds[i], {
                    parentStockItemId: null,
                    custodyType: destination.custodyType,
                    custodyHolder: destination.custodyType === "STOCK" || destination.custodyType === "DISPLAY" ? null : destination.holder.trim(),
                    custodySince: now,
                });
            }

            // The set itself leaves stock; its parent tag is retired (the pieces now count individually).
            await this._repository.updateItem(tx, unitStockItemId, { status: "CONSUMED", parentStockItemId: null });
            await this._stockItemQrRepository.retireActiveByStockItemId(tx, unitStockItemId, { retiredReason: "BROKEN" });

            const after = await this._snapshot(tx, [unitStockItemId, ...pieceIds]);
            const pieceViews = await this._repository.findItemViewsByIds(tx, pieceIds);
            const viewById = new Map(pieceViews.map((row) => [row.stockItemId, row]));

            const entry = await this._repository.createEntry(tx, {
                type: "BREAK",
                colorVariantId: unit.colorVariantId,
                unitStockItemId,
                reason,
                note: note || null,
                createdBy: DEFAULT_ACTOR,
                snapshotBefore: before,
                snapshotAfter: after,
                metadata: {
                    unitCode: unit.shortCode,
                    unitKind: unit.type === "SET" ? "SET" : "SEMI",
                    createdItemIds,
                    createdQrIds,
                    pieces: pieceIds.map((id, index) => ({
                        stockItemId: id,
                        code: viewById.get(id)?.shortCode ?? null,
                        size: viewById.get(id)?.sizeLabel ?? slots[index].size,
                        custodyType: destinations[index].custodyType,
                        holder: destinations[index].holder?.trim() || null,
                    })),
                    holders: destinations.filter((destination) => destination.holder?.trim()).map((destination) => ({ type: destination.custodyType, holder: destination.holder.trim() })),
                },
            });

            await this._stockHistoryService.record(tx, "SET_BROKEN", {
                colorVariantId: unit.colorVariantId,
                quantity: pieceIds.length,
                metadata: { sourceStockItemId: unitStockItemId, resultStockItemIds: pieceIds, reasonCode: reason, note: note || null, transformationId: entry.id },
            });

            return { entry, retiredShortCode: unit.shortCode, pieces: pieceIds.map((id) => ({ stockItemId: id, code: viewById.get(id)?.shortCode ?? null, size: viewById.get(id)?.sizeLabel ?? null })) };
        });
    }

    _validateDestinations(destinations) {
        for (const destination of destinations) {
            if (HOLDER_REQUIRED.has(destination.custodyType) && !destination.holder?.trim()) {
                throw new ApiError("Enter who has each piece going to a salesperson, customer sample or alteration.", 400, "HOLDER_REQUIRED");
            }
        }
    }

    // ==========================================================================================
    // FORM
    // ==========================================================================================

    async formUnit({ colorVariantId, kind, stockItemIds, note }) {
        return db.transaction(async (tx) => {
            const variant = await this._colorVariantRepository.findActiveById(tx, colorVariantId);
            if (!variant) throw new ApiError(`Color variant ${colorVariantId} not found or inactive.`, 404, "VARIANT_NOT_FOUND");

            const ids = [...new Set(stockItemIds)];
            if (ids.length !== stockItemIds.length) throw new ApiError("Each piece can only be picked once.", 400, "DUPLICATE_PIECES");
            const locked = await this._repository.lockItems(tx, ids);
            if (locked.length !== ids.length) throw new ApiError("Some picked pieces no longer exist.", 404, "PIECE_NOT_FOUND");

            for (const item of locked) {
                if (item.colorVariantId !== colorVariantId) throw new ApiError("All pieces must be the same design colour.", 400, "VARIANT_MISMATCH");
                const loosePiece = item.type === "PIECE" && item.status !== "CONSUMED" && !item.parentStockItemId && item.custodyType === "STOCK";
                const looseUntagged = item.type === "LOOSE_PIECE" && item.status === "UNSET";
                if (!loosePiece && !looseUntagged) {
                    throw new ApiError(`Piece #${item.id} isn't a loose piece on the shelf any more — refresh and pick again.`, 409, "PIECE_NOT_AVAILABLE");
                }
                if (!item.designSizeId) throw new ApiError(`Piece #${item.id} has no size and can't join a set.`, 400, "PIECE_HAS_NO_SIZE");
            }

            const sizes = await this._designSizeRepository.findActiveByVariantId(tx, colorVariantId);
            const setSizeIds = sizes.filter((size) => size.includedInSet).map((size) => size.id);
            const countBySize = new Map();
            for (const item of locked) countBySize.set(item.designSizeId, (countBySize.get(item.designSizeId) ?? 0) + 1);

            const isExactSet = countBySize.size === setSizeIds.length && setSizeIds.every((id) => countBySize.get(id) === 1);
            if (kind === "SET" && !isExactSet) {
                throw new ApiError("A complete set needs exactly one piece of every set size.", 400, "NOT_A_COMPLETE_SET");
            }
            if (kind === "SEMI") {
                if (locked.length < 2) throw new ApiError("A semi set needs at least 2 pieces.", 400, "SEMI_TOO_SMALL");
                if (isExactSet) throw new ApiError("Those pieces make a complete set — form a complete set instead.", 400, "SEMI_IS_COMPLETE_SET");
                if ([...countBySize.keys()].some((id) => !sizes.some((size) => size.id === id))) {
                    throw new ApiError("A picked piece's size is no longer active for this design.", 400, "INACTIVE_SIZE");
                }
            }

            const before = await this._snapshot(tx, ids);

            const group = kind === "SET"
                ? await this._stockGroupRepository.findOrCreate(tx, { colorVariantId, type: "SET" })
                : await this._stockGroupRepository.findOrCreate(tx, {
                    colorVariantId,
                    type: "BUNDLE",
                    compositionSignature: buildBundleCompositionSignature([...countBySize.entries()].map(([designSizeId, quantity]) => ({ designSizeId, quantity }))),
                });
            const [unit] = await this._stockItemRepository.createMany(tx, [{
                stockGroupId: group.id,
                colorVariantId,
                stockInTransactionId: null,
                bundleId: null,
                type: kind === "SET" ? "SET" : "BUNDLE",
                status: "AVAILABLE",
            }]);
            const [unitQr] = await this._stockQrService.generateForStockItems(tx, [unit], {
                designCode: variant.designCode,
                designName: variant.designName,
                colorName: variant.colorName,
            });

            // Tagged pieces go INSIDE the new set (their own tags keep working); untagged loose pieces
            // are consumed into it, with lineage — the same way assembleSet treats loose stock.
            const tagged = locked.filter((item) => item.type === "PIECE");
            const untagged = locked.filter((item) => item.type === "LOOSE_PIECE");
            for (const item of tagged) {
                await this._repository.updateItem(tx, item.id, { parentStockItemId: unit.id, custodyType: "STOCK", custodyHolder: null, custodySince: null });
            }
            if (untagged.length) {
                await this._stockItemRepository.markConsumed(tx, untagged.map((item) => item.id));
                await this._stockItemLineageRepository.createMany(tx, untagged.map((item) => ({ resultStockItemId: unit.id, sourceStockItemId: item.id })));
            }

            // Restoring an original: every picked piece was born in the same (broken) set, and they
            // are exactly that set's surviving pieces.
            let restoredFrom = null;
            const origins = [...new Set(locked.map((item) => item.originSetStockItemId))];
            if (untagged.length === 0 && origins.length === 1 && origins[0]) {
                const bornIn = await this._repository.findPiecesBornIn(tx, [origins[0]]);
                if (bornIn.filter((row) => row.status !== "CONSUMED").length === locked.length) restoredFrom = origins[0];
            }

            const after = await this._snapshot(tx, [...ids, unit.id]);
            const views = await this._repository.findItemViewsByIds(tx, ids);
            const viewById = new Map(views.map((row) => [row.stockItemId, row]));
            const restoredCode = restoredFrom ? (await this._repository.findLatestShortCodes(tx, [restoredFrom])).get(restoredFrom) ?? null : null;

            const entry = await this._repository.createEntry(tx, {
                type: "FORM",
                colorVariantId,
                unitStockItemId: unit.id,
                restoredFromStockItemId: restoredFrom,
                reason: restoredFrom ? "Restored original set" : kind === "SET" ? "Formed complete set" : "Formed semi set",
                note: note || null,
                createdBy: DEFAULT_ACTOR,
                snapshotBefore: before,
                snapshotAfter: after,
                metadata: {
                    unitCode: unitQr?.shortCode ?? null,
                    unitKind: kind,
                    restoredCode,
                    createdItemIds: [unit.id],
                    createdQrIds: unitQr ? [unitQr.id] : [],
                    pieces: ids.map((id) => ({
                        stockItemId: id,
                        code: viewById.get(id)?.shortCode ?? null,
                        size: viewById.get(id)?.sizeLabel ?? null,
                        tagged: viewById.get(id)?.type === "PIECE",
                    })),
                },
            });

            await this._stockHistoryService.record(tx, kind === "SET" ? "SET_ASSEMBLED" : "BUNDLE_ASSEMBLED", {
                colorVariantId,
                stockGroupId: group.id,
                resultStockItemId: unit.id,
                quantity: 1,
                metadata: { sourceStockItemIds: ids, resultStockItemIds: [unit.id], restoredFrom, transformationId: entry.id },
            });

            const orderedPieces = [...views].sort((a, b) => (a.sizeOrder ?? 0) - (b.sizeOrder ?? 0));
            return {
                entry,
                unit: { stockItemId: unit.id, code: unitQr?.shortCode ?? null, kind },
                restoredFrom: restoredFrom ? { stockItemId: restoredFrom, code: restoredCode } : null,
                // Everything a label needs, for "Form set · print tags".
                labels: {
                    design: { code: variant.designCode, name: variant.designName },
                    colorName: variant.colorName,
                    sellingPricePerPiece: Number(views[0]?.sellingPricePerPiece) || 0,
                    parent: { code: unitQr?.shortCode ?? null, sizes: orderedPieces.map((row) => row.sizeLabel) },
                    children: orderedPieces.filter((row) => row.type === "PIECE" && row.shortCode).map((row) => ({ code: row.shortCode, size: row.sizeLabel })),
                },
            };
        });
    }

    // ==========================================================================================
    // MOVE / RETURN
    // ==========================================================================================

    async movePieces({ stockItemIds, custodyType, holder, reason }) {
        if (HOLDER_REQUIRED.has(custodyType) && !holder?.trim()) {
            throw new ApiError("Enter who has the pieces.", 400, "HOLDER_REQUIRED");
        }
        const cleanHolder = custodyType === "STOCK" || custodyType === "DISPLAY" ? null : holder.trim();

        return db.transaction(async (tx) => {
            const ids = [...new Set(stockItemIds)];
            const locked = await this._repository.lockItems(tx, ids);
            if (locked.length !== ids.length) throw new ApiError("Some pieces no longer exist.", 404, "PIECE_NOT_FOUND");
            for (const item of locked) {
                if (item.type !== "PIECE") throw new ApiError(`#${item.id} isn't an individually tagged piece.`, 400, "NOT_A_PIECE_TAG");
                if (item.status === "CONSUMED") throw new ApiError(`#${item.id} is no longer in stock.`, 409, "PIECE_NOT_IN_STOCK");
                if (item.parentStockItemId) throw new ApiError(`#${item.id} is inside a set — break the set first.`, 409, "PIECE_INSIDE_SET");
            }

            const toMove = locked.filter((item) => !(item.custodyType === custodyType && (item.custodyHolder ?? null) === cleanHolder));
            if (toMove.length === 0) throw new ApiError("Those pieces are already there.", 400, "NOTHING_TO_MOVE");

            const entries = [];
            const now = new Date();
            for (const [colorVariantId, items] of groupBy(toMove, (item) => item.colorVariantId)) {
                const itemIds = items.map((item) => item.id);
                const before = await this._snapshot(tx, itemIds);
                const previous = await this._repository.findItemViewsByIds(tx, itemIds);
                for (const id of itemIds) {
                    await this._repository.updateItem(tx, id, { custodyType, custodyHolder: cleanHolder, custodySince: now });
                }
                const after = await this._snapshot(tx, itemIds);
                entries.push(await this._repository.createEntry(tx, {
                    type: custodyType === "STOCK" ? "RETURN" : "MOVE",
                    colorVariantId,
                    reason: reason || null,
                    createdBy: DEFAULT_ACTOR,
                    snapshotBefore: before,
                    snapshotAfter: after,
                    metadata: {
                        custodyType,
                        holder: cleanHolder,
                        pieces: previous.map((row) => ({
                            stockItemId: row.stockItemId,
                            code: row.shortCode,
                            size: row.sizeLabel,
                            fromCustody: row.custodyType,
                            fromHolder: row.custodyHolder ?? null,
                        })),
                        holders: cleanHolder ? [{ type: custodyType, holder: cleanHolder }] : [],
                    },
                }));
            }
            return { entries, moved: toMove.length, skipped: locked.length - toMove.length };
        });
    }

    // ==========================================================================================
    // UNDO
    // ==========================================================================================

    async undo(id, { note } = {}) {
        return db.transaction(async (tx) => {
            const target = await this._repository.findEntryForUpdate(tx, id);
            if (!target) throw new ApiError("Log entry not found.", 404, "NOT_FOUND");
            if (target.type === "UNDO") throw new ApiError("An undo can't itself be undone.", 400, "CANNOT_UNDO_UNDO");
            if (target.undoneAt) throw new ApiError("This entry has already been undone.", 409, "ALREADY_UNDONE");

            const after = target.snapshotAfter;
            const itemIds = Object.keys(after.items).map(Number);
            await this._repository.lockItems(tx, itemIds);
            const current = await this._snapshot(tx, itemIds);
            if (canonical(current) !== canonical(after)) {
                throw new ApiError("Those pieces have changed since this entry, so undoing it is no longer safe.", 409, "UNDO_NOT_SAFE");
            }

            const before = target.snapshotBefore;
            for (const itemId of itemIds) {
                const prior = before.items[itemId];
                if (prior) {
                    await this._repository.updateItem(tx, itemId, {
                        status: prior.status,
                        parentStockItemId: prior.parent,
                        custodyType: prior.custody,
                        custodyHolder: prior.holder,
                        custodySince: prior.since ? new Date(prior.since) : null,
                    });
                } else {
                    // Created by the entry (a formed set, or pieces tagged at break) — retire it.
                    await this._repository.updateItem(tx, itemId, { status: "CONSUMED", parentStockItemId: null });
                }
            }
            for (const [qrId, state] of Object.entries(after.qrs)) {
                const prior = before.qrs[qrId];
                await this._repository.updateQr(tx, Number(qrId), prior
                    ? { status: prior.status, retiredAt: prior.retiredAt ? new Date(prior.retiredAt) : null, retiredReason: prior.retiredReason }
                    : { status: "RETIRED", retiredAt: state.retiredAt ? new Date(state.retiredAt) : new Date(), retiredReason: "UNDO" });
            }
            if (target.type === "FORM") await this._repository.deleteLineageByResultIds(tx, target.metadata?.createdItemIds ?? []);

            if (target.type === "BREAK" || target.type === "FORM") {
                const pieceIds = (target.metadata?.pieces ?? []).map((piece) => piece.stockItemId);
                await this._stockHistoryService.record(tx, target.type === "BREAK" ? "SET_ASSEMBLED" : "SET_BROKEN", {
                    colorVariantId: target.colorVariantId,
                    resultStockItemId: target.type === "BREAK" ? target.unitStockItemId : null,
                    quantity: target.type === "BREAK" ? 1 : pieceIds.length,
                    metadata: { undoOf: target.id, sourceStockItemId: target.unitStockItemId, resultStockItemIds: pieceIds, reasonCode: "UNDO" },
                });
            }

            await this._repository.markUndone(tx, target.id);
            const undoneState = await this._snapshot(tx, itemIds);
            return this._repository.createEntry(tx, {
                type: "UNDO",
                colorVariantId: target.colorVariantId,
                unitStockItemId: target.unitStockItemId,
                targetTransformationId: target.id,
                reason: "Undo",
                note: note || null,
                createdBy: DEFAULT_ACTOR,
                snapshotBefore: current,
                snapshotAfter: undoneState,
                metadata: { undoneType: target.type, unitCode: target.metadata?.unitCode ?? null, pieces: target.metadata?.pieces ?? [] },
            });
        });
    }

    async _snapshot(tx, itemIds) {
        const ids = [...new Set(itemIds)].sort((a, b) => a - b);
        const items = ids.length ? await this._repository.lockItems(tx, ids) : [];
        const qrs = await this._repository.findQrRowsByItemIds(tx, ids);
        return {
            items: Object.fromEntries(items.map((row) => [row.id, itemState(row)])),
            qrs: Object.fromEntries(qrs.map((row) => [row.id, qrState(row)])),
        };
    }

    // ==========================================================================================
    // Log + journey
    // ==========================================================================================

    async listLog() {
        const rows = await this._repository.findEntries(db, { limit: LOG_LIMIT });

        // An entry can be undone only while every row it touched is still exactly as it left them.
        const undoable = rows.filter(({ entry }) => entry.type !== "UNDO" && !entry.undoneAt);
        const itemIds = [...new Set(undoable.flatMap(({ entry }) => Object.keys(entry.snapshotAfter?.items ?? {}).map(Number)))];
        const currentItems = itemIds.length ? await this._stockItemRepository.findByIds(db, itemIds) : [];
        const currentQrs = await this._repository.findQrRowsByItemIds(db, itemIds);
        const itemNow = new Map(currentItems.map((row) => [String(row.id), itemState(row)]));
        const qrNow = new Map(currentQrs.map((row) => [String(row.id), qrState(row)]));

        return rows.map(({ entry, designCode, designName, colorName, colorHex }) => {
            let canUndo = false;
            if (entry.type !== "UNDO" && !entry.undoneAt) {
                const after = entry.snapshotAfter ?? { items: {}, qrs: {} };
                canUndo = Object.entries(after.items).every(([key, state]) => canonical(itemNow.get(key)) === canonical(state))
                    && Object.entries(after.qrs).every(([key, state]) => canonical(qrNow.get(key)) === canonical(state));
            }
            return {
                id: entry.id,
                type: entry.type,
                colorVariantId: entry.colorVariantId,
                design: { code: designCode, name: designName },
                variant: { colorName, colorHex },
                unitStockItemId: entry.unitStockItemId,
                restoredFromStockItemId: entry.restoredFromStockItemId,
                targetTransformationId: entry.targetTransformationId,
                reason: entry.reason,
                note: entry.note,
                metadata: entry.metadata,
                itemIds: Object.keys(entry.snapshotAfter?.items ?? {}).map(Number),
                createdBy: entry.createdBy,
                createdAt: entry.createdAt,
                undoneAt: entry.undoneAt,
                canUndo,
            };
        });
    }

    // Everything that has happened to one tag, oldest first, plus where it is now.
    async getJourney(code) {
        const id = await this._findItemIdByCode(code);
        const [row] = id ? await this._repository.findItemViewsByIds(db, [id]) : [];
        if (!row) throw new ApiError(`"${code}" isn't a known tag.`, 404, "TAG_NOT_FOUND");

        const unitIds = [row.originSetStockItemId, row.parentStockItemId, row.stockItemId].filter(Boolean);
        const unitCodes = await this._repository.findLatestShortCodes(db, unitIds);
        const isUnit = row.type === "SET" || row.type === "BUNDLE";

        const steps = [];
        if (isUnit) {
            steps.push({ at: row.receivedOn, text: row.challanNo ? `Received at Stock In · challan ${row.challanNo}` : "Created by transformation or adjustment" });
        } else {
            const origin = row.originSetStockItemId ? ` · inside ${unitCodes.get(row.originSetStockItemId) ?? `#${row.originSetStockItemId}`}` : " · as a loose piece";
            steps.push({ at: row.receivedOn, text: `Received at Stock In${row.challanNo ? ` · challan ${row.challanNo}` : ""}${origin}` });
        }

        const log = await this._repository.findEntries(db, { limit: 2000 });
        for (const { entry } of [...log].reverse()) {
            if (entry.undoneAt) continue;
            const touched = Object.prototype.hasOwnProperty.call(entry.snapshotAfter?.items ?? {}, String(row.stockItemId));
            if (!touched) continue;
            const piece = (entry.metadata?.pieces ?? []).find((item) => item.stockItemId === row.stockItemId);
            let text;
            if (entry.type === "BREAK") {
                text = isUnit ? `Broken · ${entry.reason ?? ""} · parent tag retired` : `Set ${entry.metadata?.unitCode ?? ""} broken → ${custodyText(piece?.custodyType, piece?.holder)}`;
            } else if (entry.type === "FORM") {
                text = isUnit && entry.unitStockItemId === row.stockItemId ? `Formed from ${entry.metadata?.pieces?.length ?? 0} pieces` : `Joined ${entry.metadata?.unitCode ?? "a new set"}`;
            } else if (entry.type === "MOVE") {
                text = `Moved to ${custodyText(entry.metadata?.custodyType, entry.metadata?.holder)}`;
            } else if (entry.type === "RETURN") {
                text = "Returned to stock";
            } else {
                text = `Undo of TRF-${String(entry.targetTransformationId).padStart(4, "0")}`;
            }
            steps.push({ at: entry.createdAt, text, entryId: entry.id });
        }

        const view = isUnit ? null : this._pieceView(row, { unitCodes });
        return {
            stockItemId: row.stockItemId,
            code: row.shortCode ?? unitCodes.get(row.stockItemId) ?? null,
            isUnit,
            unitKind: isUnit ? (row.type === "SET" ? "SET" : "SEMI") : null,
            unitState: isUnit ? (row.status === "CONSUMED" ? "GONE" : "INTACT") : null,
            piece: view,
            design: { code: row.designCode, name: row.designName },
            variant: { colorName: row.colorName, colorHex: row.colorHex },
            steps,
        };
    }
}

const CUSTODY_TEXT = { STOCK: "In stock", DISPLAY: "Display", SALESPERSON: "Salesperson", SAMPLE: "Customer sample", ALTERATION: "Alteration" };
function custodyText(type, holder) {
    return `${CUSTODY_TEXT[type] ?? "In stock"}${holder ? ` (${holder})` : ""}`;
}

export default new StockTransformationService();
