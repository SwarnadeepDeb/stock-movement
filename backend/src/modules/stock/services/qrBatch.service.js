import { db } from "../../../database/index.js";
import ApiError from "../../../core/apiError.js";

import qrBatchRepository from "../repositories/qrBatch.repository.js";
import stockItemQrRepository from "../repositories/stockItemQr.repository.js";
import stockGroupRepository from "../repositories/stockGroup.repository.js";
import printJobRepository from "../repositories/printJob.repository.js";
import printJobItemRepository from "../repositories/printJobItem.repository.js";
import variantSerialCounterRepository from "../repositories/variantSerialCounter.repository.js";
import stockQrService from "./stockQr.service.js";
import stockPieceExpansionService from "./stockPieceExpansion.service.js";
import { formatSerial } from "./stockInChallan.service.js";
import { generateUniqueShortCode } from "../utils/qrShortCode.util.js";

// QR Center's "Stock-in history" works on batches: one batch is one stock-in challan, which holds
// one stock-in transaction per colour variant inwarded on it. Transactions saved before challans
// existed are each their own batch. A batch id is "c<challanId>" or "t<transactionId>".
//
// What a batch "has" is read from what Stock In actually persisted — never invented here:
//   - parent tags: the SET / BUNDLE (semi set) stock items, each with a code issued at inward;
//   - child tags: PIECE items born inside a parent (Parent + Child tagging at inward);
//   - loose tags: PIECE items with no parent (loose tagging at inward);
//   - not yet tagged: sets whose pieces were never tagged, and the untagged loose pool. These get
//     their codes the first time they are printed from here (issueBatch) — the stock is already
//     registered, so issuing a code only adds the label, never changes a quantity.
const LIST_SAFETY_CAP = 2000;

const pad = (value, width) => String(value).padStart(width, "0");

// Same label the Stock In wizard shows for a colour (e.g. "KP100-MID").
const variantCodeOf = (ctx) => `${ctx.designCode ?? "DSN"}-${(ctx.colorName ?? "").replace(/\s+/g, "").slice(0, 3).toUpperCase()}`;

const batchIdOf = (ctx) => (ctx.challanId ? `c${ctx.challanId}` : `t${ctx.transactionId}`);

export function parseBatchId(batchId) {
    const match = /^([ct])(\d+)$/.exec(String(batchId ?? ""));
    if (!match) throw new ApiError(`"${batchId}" is not a valid batch id.`, 400, "INVALID_BATCH_ID");
    const id = Number(match[2]);
    return match[1] === "c" ? { challanId: id } : { transactionId: id };
}

const printStatusOf = ({ issued, printed }) => (issued === 0 || printed === 0 ? "pending" : printed >= issued ? "done" : "partial");

function toBatchHeader(contexts) {
    const first = contexts[0];
    return {
        batchId: batchIdOf(first),
        challanId: first.challanId ?? null,
        challanNo: first.challanNo,
        serialLabel: first.challanSerial ? formatSerial(first.challanSerial) : null,
        jobberName: first.jobberName ?? null,
        defectAction: first.defectAction ?? null,
        stockDate: first.stockDate,
        createdAt: first.createdAt,
    };
}

function groupIntoBatches(contexts) {
    const batches = new Map();
    for (const ctx of contexts) {
        const id = batchIdOf(ctx);
        if (!batches.has(id)) batches.set(id, []);
        batches.get(id).push(ctx);
    }
    // Colours appear in the order they were entered on the challan.
    for (const batch of batches.values()) batch.sort((a, b) => a.transactionId - b.transactionId);
    return batches;
}

function toDesignView(ctx) {
    return { id: ctx.designId, code: ctx.designCode, name: ctx.designName };
}

function toVariantView(ctx) {
    return { id: ctx.colorVariantId, colorName: ctx.colorName, colorHex: ctx.colorHex, code: variantCodeOf(ctx) };
}

class QrBatchService {
    _repository = qrBatchRepository;
    _stockItemQrRepository = stockItemQrRepository;
    _stockGroupRepository = stockGroupRepository;
    _printJobRepository = printJobRepository;
    _printJobItemRepository = printJobItemRepository;
    _variantSerialCounterRepository = variantSerialCounterRepository;
    _stockQrService = stockQrService;
    _stockPieceExpansionService = stockPieceExpansionService;

    // ---------------------------------------------------------------------------------------
    // List
    // ---------------------------------------------------------------------------------------

    async listBatches({ keyword, designId, colorVariantId, status, sort, page, limit }) {
        const contexts = await this._repository.findTransactionContexts(db, { limit: LIST_SAFETY_CAP });
        const needle = keyword?.toLowerCase();

        const searched = [...groupIntoBatches(contexts).values()].filter((batch) => {
            if (designId && !batch.some((ctx) => ctx.designId === designId)) return false;
            if (colorVariantId && !batch.some((ctx) => ctx.colorVariantId === colorVariantId)) return false;
            if (!needle) return true;

            const header = toBatchHeader(batch);
            const haystack = [header.challanNo, header.jobberName, header.serialLabel, ...batch.flatMap((ctx) => [ctx.designCode, ctx.designName, ctx.colorName])];
            return haystack.some((part) => part && String(part).toLowerCase().includes(needle));
        });

        const summaries = await this._summarise(db, searched);
        const counts = { all: summaries.length, pending: 0, partial: 0, done: 0 };
        for (const summary of summaries) counts[summary.printStatus] += 1;

        const filtered = status && status !== "all" ? summaries.filter((summary) => summary.printStatus === status) : summaries;
        filtered.sort((a, b) => {
            const byDate = new Date(a.createdAt) - new Date(b.createdAt);
            if (sort === "tags") return b.tagCount - a.tagCount || -byDate;
            return sort === "old" ? byDate : -byDate;
        });

        const offset = (page - 1) * limit;
        return {
            data: filtered.slice(offset, offset + limit),
            meta: { page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length / limit), counts },
        };
    }

    // One row per batch for the history list, from aggregate queries only — a batch's pieces are
    // never loaded here (see getBatch for the full tag list).
    async _summarise(runner, batches) {
        const contexts = batches.flat();
        if (contexts.length === 0) return [];

        const transactionIds = contexts.map((ctx) => ctx.transactionId);
        const variantIds = [...new Set(contexts.map((ctx) => ctx.colorVariantId))];

        const [stats, bare, sizes] = await Promise.all([
            this._repository.findTagStats(runner, transactionIds),
            this._repository.findParentsWithoutChildren(runner, transactionIds),
            this._repository.findActiveSizes(runner, variantIds),
        ]);
        const bundlePieces = await this._repository.findBundlePieces(runner, [...new Set(bare.filter((item) => item.bundleId).map((item) => item.bundleId))]);

        const setSizeCount = new Map();
        for (const size of sizes) if (size.includedInSet) setSizeCount.set(size.variantId, (setSizeCount.get(size.variantId) ?? 0) + 1);
        const piecesInBundle = new Map();
        for (const piece of bundlePieces) piecesInBundle.set(piece.bundleId, (piecesInBundle.get(piece.bundleId) ?? 0) + piece.quantity);

        // Pieces that tagging the untagged sets would add, per transaction.
        const untaggedChildren = new Map();
        for (const item of bare) {
            const ctx = contexts.find((candidate) => candidate.transactionId === item.transactionId);
            const pieces = item.type === "BUNDLE" ? (piecesInBundle.get(item.bundleId) ?? setSizeCount.get(ctx?.colorVariantId) ?? 0) : (setSizeCount.get(ctx?.colorVariantId) ?? 0);
            untaggedChildren.set(item.transactionId, (untaggedChildren.get(item.transactionId) ?? 0) + pieces);
        }

        return batches.map((batch) => {
            const rows = batch.map((ctx) => {
                const stat = stats.get(ctx.transactionId) ?? { issued: 0, printed: 0, sets: 0, semiSets: 0, loosePool: 0, looseTagged: 0 };
                return {
                    transactionId: ctx.transactionId,
                    design: toDesignView(ctx),
                    variant: toVariantView(ctx),
                    sets: ctx.totalSetsReceived,
                    semiSets: stat.semiSets,
                    loose: stat.loosePool + stat.looseTagged,
                    issued: stat.issued,
                    printed: stat.printed,
                    notTagged: stat.loosePool + (untaggedChildren.get(ctx.transactionId) ?? 0),
                };
            });
            const issued = rows.reduce((sum, row) => sum + row.issued, 0);
            const printed = rows.reduce((sum, row) => sum + row.printed, 0);

            return {
                ...toBatchHeader(batch),
                variants: rows.map(({ issued: _issued, printed: _printed, ...variant }) => variant),
                setCount: rows.reduce((sum, row) => sum + row.sets, 0),
                tagCount: issued,
                printedCount: printed,
                notTaggedCount: rows.reduce((sum, row) => sum + row.notTagged, 0),
                printStatus: printStatusOf({ issued, printed }),
            };
        });
    }

    // ---------------------------------------------------------------------------------------
    // Detail
    // ---------------------------------------------------------------------------------------

    async getBatch(batchId) {
        return this._loadBatch(db, batchId);
    }

    async _loadBatch(runner, batchId, { transactionIds } = {}) {
        const contexts = (await this._repository.findTransactionContexts(runner, parseBatchId(batchId))).sort((a, b) => a.transactionId - b.transactionId);
        if (contexts.length === 0) throw new ApiError(`Stock-in batch ${batchId} not found.`, 404, "BATCH_NOT_FOUND");

        const scoped = transactionIds?.length ? contexts.filter((ctx) => transactionIds.includes(ctx.transactionId)) : contexts;
        if (scoped.length === 0) throw new ApiError("None of the selected variants belong to this batch.", 400, "VARIANT_NOT_IN_BATCH");

        const shared = await this._loadShared(runner, scoped);
        const variants = scoped.map((ctx) => this._assembleVariant(ctx, shared));
        const tags = variants.flatMap((variant) => variant.tags);
        const issued = tags.filter((tag) => tag.code).length;
        const printed = tags.filter((tag) => tag.printed).length;

        return {
            batch: {
                ...toBatchHeader(contexts),
                tagCount: issued,
                printedCount: printed,
                notTaggedCount: tags.length - issued,
                printStatus: printStatusOf({ issued, printed }),
            },
            variants,
        };
    }

    async _loadShared(runner, contexts) {
        const transactionIds = contexts.map((ctx) => ctx.transactionId);
        const variantIds = [...new Set(contexts.map((ctx) => ctx.colorVariantId))];

        const items = await this._repository.findItems(runner, transactionIds);
        const qrRows = await this._repository.findQrRows(runner, items.map((item) => item.id));
        const printed = await this._repository.findPrintedQrIds(runner, qrRows.filter((row) => row.status === "ACTIVE").map((row) => row.id));
        const [sizes, bundlePieces, counters] = await Promise.all([
            this._repository.findActiveSizes(runner, variantIds),
            this._repository.findBundlePieces(runner, [...new Set(items.filter((item) => item.bundleId).map((item) => item.bundleId))]),
            this._repository.findSerialCounters(runner, variantIds),
        ]);

        const group = (rows, keyOf) => {
            const map = new Map();
            for (const row of rows) {
                const key = keyOf(row);
                if (!map.has(key)) map.set(key, []);
                map.get(key).push(row);
            }
            return map;
        };

        return {
            itemsByTransaction: group(items, (item) => item.stockInTransactionId),
            qrByItem: group(qrRows, (row) => row.stockItemId),
            printed,
            sizesByVariant: group(sizes, (size) => size.variantId),
            bundlePiecesByBundle: group(bundlePieces, (piece) => piece.bundleId),
            lastPieceSerialByVariant: new Map(counters.map((row) => [row.colorVariantId, row.lastPieceSerial])),
        };
    }

    // Every tag one colour of the batch has or can still get, in the order they print: each
    // parent followed by its pieces, then loose pieces. `code` is the scannable short code, or
    // null for a tag whose code is issued on first print; `displayCode` is the readable id
    // printed on the label (for an un-issued tag it is the number it will most likely get).
    _assembleVariant(ctx, shared) {
        const items = shared.itemsByTransaction.get(ctx.transactionId) ?? [];
        const sizes = shared.sizesByVariant.get(ctx.colorVariantId) ?? [];
        const fullSet = sizes.filter((size) => size.includedInSet);
        const sizeById = new Map(sizes.map((size) => [size.id, size]));
        const variantCode = variantCodeOf(ctx);
        const defaultPrice = Number(ctx.defaultPrice ?? 0);

        const compositionOf = (parent) => {
            if (parent.type === "SET") return fullSet;
            const pieces = shared.bundlePiecesByBundle.get(parent.bundleId) ?? [];
            if (pieces.length === 0) return fullSet;
            return pieces.flatMap((piece) => {
                const size = sizeById.get(piece.designSizeId);
                return Array(piece.quantity).fill({ id: piece.designSizeId, sizeLabel: size?.sizeLabel ?? String(piece.designSizeId), price: size?.price ?? null });
            });
        };

        const liveQr = (item) => {
            const rows = shared.qrByItem.get(item.id) ?? [];
            const active = rows.filter((row) => row.status === "ACTIVE");
            return { hasRows: rows.length > 0, latest: active[0] ?? null, printed: active.some((row) => shared.printed.has(row.id)) };
        };

        const parents = items.filter((item) => item.type === "SET" || item.type === "BUNDLE");
        const childrenOf = new Map();
        const taggedLoose = [];
        for (const piece of items.filter((item) => item.type === "PIECE")) {
            if (piece.originSetStockItemId) {
                if (!childrenOf.has(piece.originSetStockItemId)) childrenOf.set(piece.originSetStockItemId, []);
                childrenOf.get(piece.originSetStockItemId).push(piece);
            } else {
                taggedLoose.push(piece);
            }
        }
        const loosePool = items.filter((item) => item.type === "LOOSE_PIECE" && item.status === "UNSET");

        let nextPieceSerial = (shared.lastPieceSerialByVariant.get(ctx.colorVariantId) ?? 0) + 1;
        const pieceCode = (prefix, item, qr) => (item.serialNo != null ? `${prefix}${variantCode}-${pad(item.serialNo, 4)}` : (qr?.shortCode ?? `#${item.id}`));
        const priceOf = (size, snapshot) => Number(snapshot ?? size?.price ?? size?.sizePrice ?? defaultPrice);

        const tags = [];

        for (const parent of parents) {
            const qr = liveQr(parent);
            // A parent whose only codes are retired (broken, voided) or that left stock without one
            // is no longer a live label.
            if ((!qr.latest && qr.hasRows) || (!qr.latest && parent.status === "CONSUMED")) continue;

            const composition = compositionOf(parent);
            const semi = parent.type === "BUNDLE" && composition.length < fullSet.length;
            const parentDisplay = parent.serialNo != null
                ? `${semi ? "SEMI" : "SET"}-${variantCode}-${pad(parent.serialNo, 3)}`
                : (qr.latest?.shortCode ?? `#${parent.id}`);

            tags.push({
                key: `item-${parent.id}`,
                kind: "parent",
                type: parent.type,
                stockItemId: parent.id,
                qrId: qr.latest?.id ?? null,
                code: qr.latest?.shortCode ?? null,
                displayCode: parentDisplay,
                printed: qr.printed,
                semi,
                size: null,
                parentStockItemId: null,
                parentDisplayCode: null,
                composition: composition.map((size) => size.sizeLabel),
                piecesPerSet: composition.length,
                pricePerPiece: defaultPrice,
                payload: qr.latest?.payload ?? null,
            });

            const kids = childrenOf.get(parent.id) ?? [];
            if (kids.length > 0) {
                for (const kid of kids) {
                    const kidQr = liveQr(kid);
                    if (!kidQr.latest && kidQr.hasRows) continue;
                    tags.push({
                        key: `item-${kid.id}`,
                        kind: "child",
                        type: "PIECE",
                        stockItemId: kid.id,
                        qrId: kidQr.latest?.id ?? null,
                        code: kidQr.latest?.shortCode ?? null,
                        displayCode: pieceCode("", kid, kidQr.latest),
                        printed: kidQr.printed,
                        semi: false,
                        size: kid.sizeLabel,
                        parentStockItemId: parent.id,
                        parentDisplayCode: parentDisplay,
                        composition: [],
                        piecesPerSet: 0,
                        pricePerPiece: priceOf(kid, kidQr.latest?.priceSnapshot),
                        payload: kidQr.latest?.payload ?? null,
                    });
                }
            } else if (parent.status !== "CONSUMED") {
                composition.forEach((size, index) => {
                    tags.push({
                        key: `plan-${parent.id}-${index}`,
                        kind: "child",
                        type: "PIECE",
                        stockItemId: null,
                        designSizeId: size.id,
                        qrId: null,
                        code: null,
                        displayCode: `${variantCode}-${pad(nextPieceSerial++, 4)}`,
                        printed: false,
                        semi: false,
                        size: size.sizeLabel,
                        parentStockItemId: parent.id,
                        parentDisplayCode: parentDisplay,
                        composition: [],
                        piecesPerSet: 0,
                        pricePerPiece: priceOf(size, null),
                        payload: null,
                    });
                });
            }
        }

        for (const piece of taggedLoose) {
            const qr = liveQr(piece);
            if (!qr.latest && qr.hasRows) continue;
            tags.push({
                key: `item-${piece.id}`,
                kind: "loose",
                type: "PIECE",
                stockItemId: piece.id,
                qrId: qr.latest?.id ?? null,
                code: qr.latest?.shortCode ?? null,
                displayCode: pieceCode("LSE-", piece, qr.latest),
                printed: qr.printed,
                semi: false,
                size: piece.sizeLabel,
                parentStockItemId: null,
                parentDisplayCode: null,
                composition: [],
                piecesPerSet: 0,
                pricePerPiece: priceOf(piece, qr.latest?.priceSnapshot),
                payload: qr.latest?.payload ?? null,
            });
        }

        for (const piece of loosePool) {
            tags.push({
                key: `item-${piece.id}`,
                kind: "loose",
                type: "LOOSE_PIECE",
                stockItemId: piece.id,
                qrId: null,
                code: null,
                displayCode: `LSE-${variantCode}-${pad(nextPieceSerial++, 4)}`,
                printed: false,
                semi: false,
                size: piece.sizeLabel,
                parentStockItemId: null,
                parentDisplayCode: null,
                composition: [],
                piecesPerSet: 0,
                pricePerPiece: priceOf(piece, null),
                payload: null,
            });
        }

        return {
            transactionId: ctx.transactionId,
            design: toDesignView(ctx),
            variant: toVariantView(ctx),
            stockDate: ctx.stockDate,
            sellingPricePerPiece: defaultPrice,
            setSizeLabels: fullSet.map((size) => size.sizeLabel),
            piecesPerSet: fullSet.length,
            sets: ctx.totalSetsReceived,
            semiSets: parents.filter((parent) => parent.type === "BUNDLE").length,
            loose: taggedLoose.length + loosePool.length,
            defects: ctx.defectivePieces ?? 0,
            tags,
        };
    }

    // ---------------------------------------------------------------------------------------
    // Issue + print
    // ---------------------------------------------------------------------------------------

    // Step 1 of printing a batch: makes sure every tag the chosen strategy covers has a code, then
    // returns those tags (all of them, or only the not-yet-printed ones) ready to be drawn on a
    // label. Nothing is marked printed here — the browser/agent print can still be cancelled — so
    // the caller confirms afterwards with confirmPrint.
    async issueBatch(batchId, { parentChild, loose, transactionIds, reprint, kinds }) {
        if (!parentChild && !loose) throw new ApiError("Choose at least one tag type to print.", 400, "NO_TAG_TYPE_SELECTED");

        return db.transaction(async (tx) => {
            const { variants } = await this._loadBatch(tx, batchId, { transactionIds });

            for (const variant of variants) await this._issueMissingCodes(tx, variant, { parentChild, loose, kinds });

            // Re-read so the response reflects exactly what is now stored.
            const reloaded = await this._loadBatch(tx, batchId, { transactionIds });
            const wantsKind = (tag) => (tag.kind === "loose" ? loose : parentChild) && (!kinds || kinds.includes(tag.kind));
            const printItems = reloaded.variants.flatMap((variant) => variant.tags
                .filter((tag) => tag.code && wantsKind(tag) && (reprint || !tag.printed))
                .map((tag) => this._toPrintItem(tag, variant)));

            if (printItems.length === 0) {
                throw new ApiError(reprint ? "Nothing to print for the selected variants and tag types." : "Every selected tag is already printed — tick “Also reprint” to print duplicates.", 400, "NOTHING_TO_PRINT");
            }

            return { ...(await this._loadBatch(tx, batchId)), printItems };
        });
    }

    async _issueMissingCodes(tx, variant, { parentChild, loose, kinds }) {
        const colorVariantId = variant.variant.id;
        const label = { designCode: variant.design.code, designName: variant.design.name, colorName: variant.variant.colorName };
        const tags = variant.tags;

        // Parents that somehow never got a code (data from before QR generation existed).
        const uncodedParents = parentChild && (!kinds || kinds.includes("parent")) ? tags.filter((tag) => tag.kind === "parent" && !tag.code) : [];
        if (uncodedParents.length > 0) {
            await this._stockQrService.generateForStockItems(tx, uncodedParents.map((tag) => ({ id: tag.stockItemId, type: tag.type })), label);
        }

        const plannedChildren = parentChild && (!kinds || kinds.includes("child")) ? tags.filter((tag) => tag.kind === "child" && !tag.stockItemId) : [];
        const pool = loose && (!kinds || kinds.includes("loose")) ? tags.filter((tag) => tag.kind === "loose" && tag.type === "LOOSE_PIECE") : [];
        const pieceCount = plannedChildren.length + pool.length;
        if (pieceCount === 0) return;

        // Same running piece numbering Stock In uses; the upsert locks the colour's counter row, so
        // two people printing the same colour at once cannot be handed the same serial.
        const { pieceStart } = await this._variantSerialCounterRepository.reserve(tx, colorVariantId, { sets: 0, pieces: pieceCount });
        let serial = pieceStart;

        const byParent = new Map();
        for (const tag of plannedChildren) {
            if (!byParent.has(tag.parentStockItemId)) byParent.set(tag.parentStockItemId, []);
            byParent.get(tag.parentStockItemId).push(tag);
        }
        for (const [parentId, planned] of byParent) {
            const created = await this._stockPieceExpansionService.createPiecesForComposition(tx, {
                colorVariantId,
                stockInTransactionId: variant.transactionId,
                sizeEntries: planned.map((tag) => ({ designSizeId: tag.designSizeId, sizeLabel: tag.size, unsetPricePerSize: tag.pricePerPiece })),
                originSetStockItemId: parentId,
                insideParent: true,
                ...label,
            });
            for (const row of created) await this._repository.assignSerial(tx, row.stockItem.id, serial++);
        }

        if (pool.length > 0) {
            const pieceGroup = await this._stockGroupRepository.findOrCreate(tx, { colorVariantId, type: "PIECE" });
            const converted = await this._repository.convertLooseToTagged(tx, pool.map((tag) => tag.stockItemId), { stockGroupId: pieceGroup.id });
            const priceById = new Map(pool.map((tag) => [tag.stockItemId, tag.pricePerPiece]));
            for (const item of converted.sort((a, b) => a.id - b.id)) {
                const shortCode = await generateUniqueShortCode((candidate) => this._stockItemQrRepository.existsActiveShortCode(tx, candidate));
                await this._stockItemQrRepository.create(tx, {
                    stockItemId: item.id,
                    payload: this._stockQrService.buildPayload({ ...label, stockItemId: item.id }),
                    shortCode,
                    status: "ACTIVE",
                    priceSnapshot: priceById.get(item.id) ?? null,
                });
                await this._repository.assignSerial(tx, item.id, serial++);
            }
        }
    }

    // The shape the print sheet / local print agent draw labels from (see ConfirmedA4QrPrintSheet).
    _toPrintItem(tag, variant) {
        const payload = { ...(tag.payload ?? {}) };
        if (tag.kind === "child" && tag.parentDisplayCode) payload.parentSetId = tag.parentDisplayCode;

        return {
            stockItemId: tag.stockItemId,
            qrId: tag.qrId,
            kind: tag.kind,
            type: tag.type === "LOOSE_PIECE" ? "PIECE" : tag.type,
            shortCode: tag.code,
            displayCode: tag.displayCode,
            payload,
            priceSnapshot: tag.pricePerPiece,
            sellingPricePerPiece: variant.sellingPricePerPiece,
            designSizeLabel: tag.size,
            parentStockItemId: tag.parentStockItemId,
            design: variant.design,
            variant: variant.variant,
            composition: tag.composition,
            piecesPerSet: tag.piecesPerSet,
            isSemiSet: tag.semi,
        };
    }

    // Step 2: the labels really were printed — record one print job for them so the batch's
    // status moves on. Only codes that belong to this batch can be confirmed.
    async confirmPrint(batchId, { stockItemQrIds, printerId }) {
        return db.transaction(async (tx) => {
            const { variants } = await this._loadBatch(tx, batchId);
            const batchTags = new Map(variants.flatMap((variant) => variant.tags).filter((tag) => tag.qrId).map((tag) => [tag.qrId, tag]));

            const unknown = stockItemQrIds.filter((id) => !batchTags.has(id));
            if (unknown.length > 0) throw new ApiError(`${unknown.length} of those tags don't belong to this batch.`, 400, "TAG_NOT_IN_BATCH");

            const alreadyPrinted = stockItemQrIds.every((id) => batchTags.get(id).printed);
            const printJob = await this._printJobRepository.create(tx, {
                printerId: printerId ?? null,
                jobType: alreadyPrinted ? "REPRINT" : "QR_GENERATE",
                status: "COMPLETED",
                totalCount: stockItemQrIds.length,
                createdBy: null,
            });

            const printedAt = new Date();
            await this._printJobItemRepository.createMany(tx, stockItemQrIds.map((stockItemQrId, index) => ({
                printJobId: printJob.id,
                stockItemQrId,
                sequence: index + 1,
                printedAt,
            })));

            return { printJob, printedCount: stockItemQrIds.length, ...(await this._loadBatch(tx, batchId)) };
        });
    }
}

export default new QrBatchService();








