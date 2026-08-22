import { db } from "../../../database/index.js";
import ApiError from "../../../core/apiError.js";

import stockItemRepository from "../repositories/stockItem.repository.js";
import stockItemQrRepository from "../repositories/stockItemQr.repository.js";
import stockInTransactionRepository from "../repositories/stockInTransaction.repository.js";
import stockHistoryRepository from "../repositories/stockHistory.repository.js";
import stockQrService from "./stockQr.service.js";
import stockHistoryService from "./stockHistory.service.js";
import { buildDisplayCode } from "../utils/qrDisplayCode.util.js";

import rackRepository from "../repositories/rack.repository.js";
import binRepository from "../repositories/bin.repository.js";
import printerRepository from "../repositories/printer.repository.js";
import printJobRepository from "../repositories/printJob.repository.js";
import printJobItemRepository from "../repositories/printJobItem.repository.js";
import reprintRequestRepository from "../repositories/reprintRequest.repository.js";
import recoveryEntryRepository from "../repositories/recoveryEntry.repository.js";
import tagPresetRepository from "../repositories/tagPreset.repository.js";
import stockGroupRepository from "../repositories/stockGroup.repository.js";
import stockInBundlePieceRepository from "../repositories/stockInBundlePiece.repository.js";
import stockPieceExpansionService from "./stockPieceExpansion.service.js";
import stockTransformationService from "./stockTransformation.service.js";

import designRepository from "../../design/repositories/design.repository.js";
import designSizeRepository from "../../design/repositories/designSize.repository.js";
import colorVariantRepository from "../../design/repositories/colorVariant.repository.js";

import { generateUniqueShortCode } from "../utils/qrShortCode.util.js";

// findByStockItemIds returns rows newest-first — keep only the first (latest) row per
// stock item so a stock item with QR "history" (see stockItemQr.schema.js) still resolves
// to a single current QR everywhere in this service.
function latestQrByStockItemId(qrRows) {
    const map = new Map();
    for (const row of qrRows) {
        if (!map.has(row.stockItemId)) map.set(row.stockItemId, row);
    }
    return map;
}

function toQrView(qrRow) {
    if (!qrRow) return null;
    return { generatedAt: qrRow.generatedAt, payload: qrRow.payload, shortCode: qrRow.shortCode };
}

// QR Center merges two kinds of stock event into one "registration" list — Stock In
// transactions and transformation (assembly) events — each fetched from its own table and
// capped rather than a cross-table SQL UNION, then merged/sorted/paginated here. This app's
// registration volume is small (a business's own inventory events, not a high-volume feed),
// so an in-memory merge is simpler and safer than getting set-operator column aliasing exactly
// right; if registration volume ever approaches this cap, replace this with a real UNION ALL
// query ordered/paginated at the database level.
const REGISTRATION_SAFETY_CAP = 1000;

// eligibleItemCount vs qrGeneratedCount only ever disagrees if QR generation was interrupted
// before this registration's stock-in transaction committed (impossible — see
// stockIn.service.js, which generates QRs in the same transaction as the stock items
// themselves) or a stock item is still mid-backfill via the manual /qr-center/generate path.
// Kept as a real comparison rather than hardcoded "READY" so that edge case still surfaces.
function toStockInRegistrationView(row) {
    return {
        registrationType: "STOCK_IN",
        registrationId: row.stockInTransactionId,
        challanNo: row.challanNo,
        createdAt: row.createdAt,
        displayDate: row.stockDate,
        design: {
            id: row.designId,
            code: row.designCode,
            name: row.designName,
        },
        variant: {
            id: row.colorVariantId,
            colorName: row.colorName,
            colorHex: row.colorHex,
            imageUrl: row.imageUrl,
        },
        typeCounts: {
            SET: row.setCount,
            BUNDLE: row.bundleCount,
        },
        qrCount: row.qrGeneratedCount,
        eligibleItemCount: row.eligibleItemCount,
        qrStatus: row.qrGeneratedCount >= row.eligibleItemCount ? "READY" : "PARTIAL",
    };
}

// A transformation's QR generation is never partial (see stockItem.service.js
// assembleSet/assembleBundle — generation happens in the same transaction as the event
// itself), so qrCount/eligibleItemCount are both just `quantity` and qrStatus is always READY.
function toTransformationRegistrationView(row) {
    const isSet = row.eventType === "SET_ASSEMBLED";

    return {
        registrationType: "TRANSFORMATION",
        registrationId: row.id,
        transformationType: row.eventType,
        createdAt: row.createdAt,
        displayDate: row.createdAt,
        design: {
            id: row.designId,
            code: row.designCode,
            name: row.designName,
        },
        variant: {
            id: row.colorVariantId,
            colorName: row.colorName,
            colorHex: row.colorHex,
            imageUrl: row.imageUrl,
        },
        typeCounts: {
            SET: isSet ? row.quantity : 0,
            BUNDLE: isSet ? 0 : row.quantity,
        },
        qrCount: row.quantity,
        eligibleItemCount: row.quantity,
        qrStatus: "READY",
    };
}

// Every stock_history assembly event stores which stock items it created — as a plural array
// for a bulk transformation (see stockItem.service.js's generalized assembleSet), or as the
// legacy singular field for a single-unit event (assembleBundle, or an assembleSet call made
// before that generalization). Always resolve through here rather than reading either field
// directly, so both shapes keep working.
function resultStockItemIdsFromMetadata(event) {
    const metadata = event.metadata ?? {};
    if (Array.isArray(metadata.resultStockItemIds)) return metadata.resultStockItemIds;
    if (metadata.resultStockItemId) return [metadata.resultStockItemId];
    return [];
}

// Fixed small vocabulary (see stockItemQr.schema.js / reprintRequest.schema.js) surfaced
// read-only from GET /qr-center/reference — never a table of their own, same rationale as
// retiredReason not being a foreign key.
const REASON_CODES = [
    { code: "LOST", label: "Lost" },
    { code: "TORN", label: "Torn" },
    { code: "FADED", label: "Faded" },
    { code: "REBAG", label: "Re-bag" },
    { code: "JAM", label: "Jam" },
    { code: "PRICE_CHANGE", label: "Price change" },
];

// Descriptive only (no auth module exists — see class-level comment in every schema's
// `performedBy`/`raisedBy`/`createdBy` field) — purely informational copy for the reference
// panel's role/capability legend.
const PERMISSIONS = [
    { role: "Godown Worker", capabilities: "Raise reprint requests, Scan & resolve codes" },
    { role: "Back Office", capabilities: "Print batches, Manage queues, Accept stale" },
    { role: "Supervisor", capabilities: "Approve recovery, Void labels, Rack reconcile" },
];

// Safety cap for in-memory bulk operations over a set of stock items (migration-run) — same
// rationale/order-of-magnitude as REGISTRATION_SAFETY_CAP above.
const BULK_SAFETY_CAP = 1000;

// Recent-print window for the duplicate-print guard (print-check) — a code printed again inside
// this window is surfaced as a likely accidental re-print, not a hard block.
const PRINT_CHECK_WINDOW_MS = 15 * 60 * 1000;

function daysSince(date) {
    if (!date) return null;
    const ms = Date.now() - new Date(date).getTime();
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function toMoneyString(value) {
    if (value === null || value === undefined) return null;
    return Number(value).toFixed(2);
}

function designView(context) {
    return { id: context.designId, code: context.designCode, name: context.designName };
}

function variantView(context) {
    return { id: context.colorVariantId, colorName: context.colorName, colorHex: context.colorHex };
}

class QrCenterService {
    _stockItemRepository = stockItemRepository;
    _stockItemQrRepository = stockItemQrRepository;
    _stockInTransactionRepository = stockInTransactionRepository;
    _stockHistoryRepository = stockHistoryRepository;
    _stockQrService = stockQrService;
    _stockHistoryService = stockHistoryService;

    _rackRepository = rackRepository;
    _binRepository = binRepository;
    _printerRepository = printerRepository;
    _printJobRepository = printJobRepository;
    _printJobItemRepository = printJobItemRepository;
    _reprintRequestRepository = reprintRequestRepository;
    _recoveryEntryRepository = recoveryEntryRepository;
    _tagPresetRepository = tagPresetRepository;
    _stockGroupRepository = stockGroupRepository;
    _stockInBundlePieceRepository = stockInBundlePieceRepository;
    _stockPieceExpansionService = stockPieceExpansionService;

    _designRepository = designRepository;
    _designSizeRepository = designSizeRepository;
    _colorVariantRepository = colorVariantRepository;

    // QR Center listing: one row per stock EVENT that produced QR-eligible stock — a Stock In
    // transaction, or a loose-to-set/bundle transformation — not one row per QR. Each source is
    // queried independently (see stockInTransaction.repository.js's findRegistrationsWithQr and
    // stockHistory.repository.js's findAssemblyRegistrations) and merged/sorted/paginated here;
    // see REGISTRATION_SAFETY_CAP above for why this isn't a single cross-table SQL query.
    async listRegistrations({ page, limit, keyword, designId, colorVariantId, dateFrom, dateTo, sort }) {
        const [stockInRows, transformationRows, stockInTotal, transformationTotal] = await Promise.all([
            this._stockInTransactionRepository.findRegistrationsWithQr(db, { limit: REGISTRATION_SAFETY_CAP, offset: 0, keyword, designId, colorVariantId, dateFrom, dateTo }),
            this._stockHistoryRepository.findAssemblyRegistrations(db, { limit: REGISTRATION_SAFETY_CAP, keyword }),
            this._stockInTransactionRepository.countRegistrationsWithQr(db, { keyword, designId, colorVariantId, dateFrom, dateTo }),
            this._stockHistoryRepository.countAssemblyRegistrations(db, { keyword }),
        ]);

        const merged = [
            ...stockInRows.map(toStockInRegistrationView),
            ...transformationRows.map(toTransformationRegistrationView),
        ].sort((a, b) => sort === "old" ? new Date(a.createdAt) - new Date(b.createdAt) : new Date(b.createdAt) - new Date(a.createdAt));

        const total = stockInTotal + transformationTotal;
        const offset = (page - 1) * limit;
        const pageRows = merged.slice(offset, offset + limit);
        const withPrintStatus = await this._attachPrintStatus(pageRows);

        return {
            data: withPrintStatus,
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    // QR Center history's status pills/tabs (pending/partial/done) need "how many of this
    // registration's tags have actually been PRINTED" — not tracked on the registration row
    // itself, only derivable by checking print_job_items for each of its QRs. Only computed for
    // the current page (not every matching registration) to avoid an unbounded fan-out of
    // queries — see REGISTRATION_SAFETY_CAP's own comment for why in-memory merge/paginate is
    // already the accepted tradeoff here.
    async _attachPrintStatus(registrations) {
        return Promise.all(registrations.map(async (r) => {
            if (r.registrationType !== "STOCK_IN") {
                // Transformation QR generation is always complete in the same transaction as the
                // event itself (see toTransformationRegistrationView) — treated as fully printed.
                return { ...r, printedCount: r.qrCount, totalCount: r.qrCount, printStatus: "done" };
            }

            const qrRows = await this._stockItemQrRepository.findByStockInTransactionId(db, r.registrationId);
            const latestQrRowsByStockItemId = latestQrByStockItemId(qrRows);
            const qrIds = [...latestQrRowsByStockItemId.values()].map((row) => row.id);
            const totalCount = qrIds.length;

            const printed = qrIds.length ? await this._printJobItemRepository.findRecentByQrIds(db, qrIds, null) : [];
            const printedCount = new Set(printed.map((row) => row.stockItemQrId)).size;

            const printStatus = totalCount === 0 || printedCount === 0
                ? "pending"
                : printedCount >= totalCount ? "done" : "partial";

            return { ...r, printedCount, totalCount, printStatus };
        }));
    }

    // QR Grid page: one registration's identity plus every QR generated under it. Read-only —
    // never generates a QR, only ever reads what registerStockIn/assembleSet/assembleBundle
    // already persisted. Dispatches on registrationType rather than being two separate methods
    // (getRegistrationDetail vs a hypothetical getTransformationDetail) so QR Center has exactly
    // one "load a registration's detail" entry point, same as it has exactly one listing method.
    async getRegistrationDetail({ registrationType, registrationId }) {
        if (registrationType === "TRANSFORMATION") {
            return this._getTransformationRegistrationDetail(registrationId);
        }
        return this._getStockInRegistrationDetail(registrationId);
    }

    async _getStockInRegistrationDetail(stockInTransactionId) {
        const registration = await this._stockInTransactionRepository.findByIdWithContext(db, stockInTransactionId);
        if (!registration) {
            throw new ApiError(`Stock registration ${stockInTransactionId} not found.`, 404, "STOCK_REGISTRATION_NOT_FOUND");
        }

        const qrRows = await this._stockItemQrRepository.findByStockInTransactionId(db, stockInTransactionId);
        const latestQrRowsByStockItemId = latestQrByStockItemId(qrRows);

        const qrs = [...latestQrRowsByStockItemId.values()]
            .map((row) => ({
                stockItemId: row.stockItemId,
                type: row.type,
                payload: row.payload,
                // What the printed QR encodes — the code the scan lookup resolves.
                shortCode: row.shortCode,
                priceSnapshot: row.priceSnapshot,
                designSizeLabel: row.designSizeLabel,
                parentStockItemId: row.parentStockItemId,
                generatedAt: row.generatedAt,
            }))
            .sort((a, b) => a.stockItemId - b.stockItemId);

        return {
            registration: {
                registrationType: "STOCK_IN",
                registrationId: registration.stockInTransactionId,
                stockInTransactionId: registration.stockInTransactionId,
                stockDate: registration.stockDate,
                challanNo: registration.challanNo,
                createdAt: registration.createdAt,
                design: {
                    id: registration.designId,
                    code: registration.designCode,
                    name: registration.designName,
                },
                variant: {
                    id: registration.colorVariantId,
                    colorName: registration.colorName,
                    colorHex: registration.colorHex,
                    imageUrl: registration.imageUrl,
                },
                totalQrCount: qrs.length,
            },
            qrs,
        };
    }

    // Transformation Event → created SET/BUNDLE stock items → their QRs. The event's own
    // metadata already names every stock item it created (resultStockItemIdsFromMetadata) and
    // every loose piece it consumed (metadata.sourceStockItemIds) — no join back through
    // stock_item_lineage is needed just to answer "what does this registration contain".
    async _getTransformationRegistrationDetail(transformationId) {
        const event = await this._stockHistoryRepository.findByIdWithContext(db, transformationId);
        if (!event) {
            throw new ApiError(`Stock transformation ${transformationId} not found.`, 404, "STOCK_TRANSFORMATION_NOT_FOUND");
        }

        const resultStockItemIds = resultStockItemIdsFromMetadata(event);
        const itemType = event.eventType === "SET_ASSEMBLED" ? "SET" : "BUNDLE";

        const qrRows = await this._stockItemQrRepository.findByStockItemIds(db, resultStockItemIds);
        const latestQrRowsByStockItemId = latestQrByStockItemId(qrRows);

        const qrs = [...latestQrRowsByStockItemId.values()]
            .map((row) => ({
                stockItemId: row.stockItemId,
                type: itemType,
                payload: row.payload,
                shortCode: row.shortCode,
                generatedAt: row.generatedAt,
            }))
            .sort((a, b) => a.stockItemId - b.stockItemId);

        return {
            registration: {
                registrationType: "TRANSFORMATION",
                registrationId: event.id,
                transformationType: event.eventType,
                createdAt: event.createdAt,
                design: {
                    id: event.designId,
                    code: event.designCode,
                    name: event.designName,
                },
                variant: {
                    id: event.colorVariantId,
                    colorName: event.colorName,
                    colorHex: event.colorHex,
                    imageUrl: event.imageUrl,
                },
                unitsCreated: event.quantity,
                consumedStockItemIds: event.metadata?.sourceStockItemIds ?? [],
                totalQrCount: qrs.length,
            },
            qrs,
        };
    }

    // "Configure & print" drawer: for one Stock-In registration, how many of its SET/BUNDLE
    // stock items were never actually PRINTED — QR codes are minted in the same transaction as
    // Stock In itself (see stockIn.service.js), so "skipped at stock-in" in practice almost
    // always means the code was issued but no physical label was ever produced, not that no
    // code exists at all (see _attachPrintStatus above, which this reuses the same
    // findRecentByQrIds join pattern from). A true no-QR-at-all gap (pre-QR-Center legacy stock)
    // is covered separately by the SET/BUNDLE ids this also surfaces — findByStockInTransactionId
    // only returns rows that HAVE a QR, so any stock item with none simply has no entry in
    // latestQrRowsByStockItemId and is reported via missingQrStockItemIds instead. LOOSE_PIECE
    // stock is reported as a count only (untaggedLooseCount) — a LOOSE_PIECE row is
    // pooled/fungible and never individually QR-eligible (see stockItem.repository.js
    // isQrEligible), so it's informational context on the drawer, not something either
    // action list can ever include.
    async getBatchQueue(stockInTransactionId) {
        const registration = await this._stockInTransactionRepository.findByIdWithContext(db, stockInTransactionId);
        if (!registration) {
            throw new ApiError(`Stock registration ${stockInTransactionId} not found.`, 404, "STOCK_REGISTRATION_NOT_FOUND");
        }

        const items = await this._stockItemRepository.findByStockInTransactionId(db, stockInTransactionId);
        const qrRows = await this._stockItemQrRepository.findByStockInTransactionId(db, stockInTransactionId);
        const latestQrRowsByStockItemId = latestQrByStockItemId(qrRows);

        const setBundleItems = items.filter((item) => item.type === "SET" || item.type === "BUNDLE");
        const withQr = setBundleItems.filter((item) => latestQrRowsByStockItemId.has(item.id));
        const missingQrStockItemIds = setBundleItems.filter((item) => !latestQrRowsByStockItemId.has(item.id)).map((item) => item.id);
        const untaggedLooseCount = items.filter((item) => item.type === "LOOSE_PIECE").length;

        const qrIds = withQr.map((item) => latestQrRowsByStockItemId.get(item.id).id);
        const printed = qrIds.length ? await this._printJobItemRepository.findRecentByQrIds(db, qrIds, null) : [];
        const printedQrIds = new Set(printed.map((row) => row.stockItemQrId));
        const unprintedStockItemQrIds = qrIds.filter((id) => !printedQrIds.has(id));

        return {
            registration: {
                stockInTransactionId: registration.stockInTransactionId,
                challanNo: registration.challanNo,
                stockDate: registration.stockDate,
                design: { id: registration.designId, code: registration.designCode, name: registration.designName },
                variant: { id: registration.colorVariantId, colorName: registration.colorName, colorHex: registration.colorHex },
            },
            unprintedCount: unprintedStockItemQrIds.length,
            missingQrCount: missingQrStockItemIds.length,
            untaggedLooseCount,
            unprintedStockItemQrIds,
            missingQrStockItemIds,
        };
    }

    // "Configure & print" drawer's Print button — creates a real print_jobs/print_job_items
    // record for tags that already have a code (issued at Stock In) but were never physically
    // printed, without minting new QR rows (a reprint mints a new row; this is each code's
    // FIRST print, so the existing row is what gets marked printed). Any stock item that never
    // got a QR at all is generated first via the existing generateForStockItemIds path, then
    // included in the same print job — one button covers both gaps the drawer can show.
    async printBatchQueue(stockInTransactionId, { printerId }) {
        return db.transaction(async (tx) => {
            const queue = await this.getBatchQueue(stockInTransactionId);
            const generated = queue.missingQrStockItemIds.length
                ? await this._generateQrRowsForStockItemIds(tx, queue.missingQrStockItemIds)
                : [];

            const qrIdsToPrint = [...queue.unprintedStockItemQrIds, ...generated.map((row) => row.id)];
            if (qrIdsToPrint.length === 0) {
                throw new ApiError(`Nothing to print for stock registration ${stockInTransactionId}.`, 400, "NOTHING_TO_PRINT");
            }

            const printJob = await this._printJobRepository.create(tx, {
                printerId: printerId ?? null,
                jobType: "QR_GENERATE",
                status: "COMPLETED",
                totalCount: qrIdsToPrint.length,
                createdBy: null,
            });

            await this._printJobItemRepository.createMany(tx, qrIdsToPrint.map((stockItemQrId, index) => ({
                printJobId: printJob.id,
                stockItemQrId,
                sequence: index + 1,
                printedAt: new Date(),
            })));

            return { printJob, printedCount: qrIdsToPrint.length };
        });
    }

    // Idempotent by design: a stock item that already has a QR is reported back as
    // ALREADY_EXISTS with its existing QR rather than generating a duplicate history row
    // (stock_item_qr has no unique constraint on stock_item_id, so nothing at the DB layer
    // would stop that — see stockItemQr.schema.js). An id that isn't QR-eligible (wrong
    // type, CONSUMED, or unknown) is reported back as skipped instead of failing the batch.
    async generateForStockItemIds(stockItemIds) {
        return db.transaction(async (tx) => {
            const uniqueIds = [...new Set(stockItemIds)];

            const eligibleItems = await this._stockItemRepository.findEligibleByIds(tx, uniqueIds);
            const eligibleIds = new Set(eligibleItems.map((item) => item.stockItemId));
            const skipped = uniqueIds
                .filter((id) => !eligibleIds.has(id))
                .map((stockItemId) => ({ stockItemId, reason: "NOT_ELIGIBLE_OR_NOT_FOUND" }));

            const existingQrRows = await this._stockItemQrRepository.findByStockItemIds(tx, [...eligibleIds]);
            const latestQrById = latestQrByStockItemId(existingQrRows);

            const needsGeneration = eligibleItems.filter((item) => !latestQrById.has(item.stockItemId));

            // generateForStockItems bakes one shared {designCode, designName, colorName} into
            // every row it creates (see stockQr.service.js) — correct only within a single
            // color variant, so a mixed-variant selection is grouped before calling it.
            const groupsByVariant = new Map();
            for (const item of needsGeneration) {
                if (!groupsByVariant.has(item.colorVariantId)) groupsByVariant.set(item.colorVariantId, []);
                groupsByVariant.get(item.colorVariantId).push(item);
            }

            const generatedById = new Map();
            for (const groupItems of groupsByVariant.values()) {
                const { designCode, designName, colorName } = groupItems[0];
                const created = await this._stockQrService.generateForStockItems(
                    tx,
                    groupItems.map((item) => ({ id: item.stockItemId, type: item.type })),
                    { designCode, designName, colorName }
                );
                for (const row of created) generatedById.set(row.stockItemId, row);
            }

            const results = eligibleItems.map((item) => {
                const existing = latestQrById.get(item.stockItemId);
                const qrRow = existing ?? generatedById.get(item.stockItemId);

                return {
                    stockItemId: item.stockItemId,
                    status: existing ? "ALREADY_EXISTS" : "GENERATED",
                    qr: toQrView(qrRow),
                };
            });

            return {
                results,
                generatedCount: needsGeneration.length,
                alreadyExistedCount: eligibleItems.length - needsGeneration.length,
                skipped,
            };
        });
    }

    // Shared by every bulk generator that mints fresh QRs for still-untagged SET/BUNDLE stock
    // items (migration-run) — same variant-grouping rationale as generateForStockItemIds above,
    // just always-run-inside-the-caller's-own-transaction rather than opening its own, so a
    // bulk generator's printJob creation stays atomic with the QR rows it prints.
    async _generateQrRowsForStockItemIds(tx, stockItemIds) {
        const eligibleItems = await this._stockItemRepository.findEligibleByIds(tx, stockItemIds);

        const groupsByVariant = new Map();
        for (const item of eligibleItems) {
            if (!groupsByVariant.has(item.colorVariantId)) groupsByVariant.set(item.colorVariantId, []);
            groupsByVariant.get(item.colorVariantId).push(item);
        }

        const created = [];
        for (const groupItems of groupsByVariant.values()) {
            const { designCode, designName, colorName } = groupItems[0];
            const rows = await this._stockQrService.generateForStockItems(
                tx,
                groupItems.map((item) => ({ id: item.stockItemId, type: item.type })),
                { designCode, designName, colorName }
            );
            created.push(...rows);
        }
        return created;
    }

    // === 1. Resolve =========================================================================

    // Resolves any scanned/typed code to one of six states. Never 404s — an unrecognized code is
    // a valid UNKNOWN result, not an error (see QR_CENTER_API_CONTRACT.md §1). Read-only, so runs
    // against `db` directly rather than opening a transaction.
    async resolve(code) {
        const rackRow = await this._rackRepository.findByCode(db, code);
        if (rackRow) return this._resolveRackState(rackRow);

        const qrRows = await this._stockItemQrRepository.findByShortCode(db, code);
        if (qrRows.length === 0) return { state: "UNKNOWN", code };

        const activeRows = qrRows.filter((row) => row.status === "ACTIVE");
        const activeStockItemIds = [...new Set(activeRows.map((row) => row.stockItemId))];

        if (activeStockItemIds.length > 1) return this._resolveDuplicateState(code, activeRows);
        if (activeStockItemIds.length === 1) return this._resolveActiveState(activeRows[0]);

        // No ACTIVE row for this shortCode at all — every match is retired history.
        return this._resolveRetiredState(qrRows[0]);
    }

    async _resolveRackState(rackRow) {
        const [{ expectedSets, scannedSets }, breakdown] = await Promise.all([
            this._rackRepository.findSetCountsByRackId(db, rackRow.id),
            this._rackRepository.findBreakdownByRackId(db, rackRow.id),
        ]);

        return {
            state: "RACK",
            rack: {
                id: rackRow.id,
                code: rackRow.code,
                expectedSets,
                scannedSets,
                missing: expectedSets - scannedSets,
                breakdown: breakdown.map((row) => ({
                    designCode: row.designCode,
                    colorName: row.colorName,
                    colorHex: row.colorHex,
                    sets: row.sets,
                })),
            },
        };
    }

    async _resolveDuplicateState(code, activeRows) {
        const recent = await this._printJobItemRepository.findRecentByQrIds(db, activeRows.map((row) => row.id), null);

        const latestByQrId = new Map();
        for (const row of recent) {
            const existing = latestByQrId.get(row.stockItemQrId);
            if (!existing || new Date(row.printedAt ?? 0) > new Date(existing.printedAt ?? 0)) {
                latestByQrId.set(row.stockItemQrId, row);
            }
        }

        return {
            state: "DUPLICATE",
            duplicate: {
                shortCode: code,
                events: activeRows.map((row) => {
                    const match = latestByQrId.get(row.id);
                    return {
                        stockItemId: row.stockItemId,
                        printJobId: match?.printJobId ?? null,
                        printerName: match?.printerName ?? null,
                        printedAt: match?.printedAt ?? null,
                        createdBy: match?.printedBy ?? null,
                    };
                }),
            },
        };
    }

    async _resolveActiveState(activeRow) {
        const context = await this._stockItemRepository.findWithContextById(db, activeRow.stockItemId);
        if (!context) return { state: "UNKNOWN", code: activeRow.shortCode };

        if (context.type === "SET" || context.type === "BUNDLE") return this._resolveSetState(activeRow, context);
        if (context.type === "PIECE") return this._resolvePieceState(activeRow, context);

        // LOOSE_PIECE (or any future type) is never individually QR-scanned — defensive fallback.
        return { state: "UNKNOWN", code: activeRow.shortCode };
    }

    async _resolveSetState(activeRow, context) {
        const activeSizes = await this._designSizeRepository.findActiveByVariantId(db, context.colorVariantId);
        const setSizes = activeSizes.filter((size) => size.includedInSet);

        // MRP = sum of each set-size's own price where snapshotted, falling back to the design's
        // flat per-piece price for any size that predates unsetPricePerSize being populated.
        const mrpValue = setSizes.reduce((sum, size) => {
            const perPiece = size.unsetPricePerSize !== null ? Number(size.unsetPricePerSize) : Number(context.defaultSellingPricePerPiece);
            return sum + perPiece;
        }, 0);

        const { inwardBatch, inwardDate, timesPrinted, lastPrintedAt } = await this._resolveInwardAndPrintInfo(activeRow, context);

        return {
            state: "SET",
            set: {
                shortCode: activeRow.shortCode,
                stockItemId: context.stockItemId,
                design: designView(context),
                variant: variantView(context),
                pieceCount: setSizes.length,
                sizeLabels: setSizes.map((size) => size.sizeLabel),
                rack: context.rackId ? { id: context.rackId, code: context.rackCode } : null,
                sealedDays: daysSince(activeRow.generatedAt),
                mrp: toMoneyString(mrpValue),
                inwardBatch,
                inwardDate,
                timesPrinted,
                lastPrintedAt,
            },
        };
    }

    // Shared by _resolveSetState/_resolvePieceState — the tag detail view's inward batch/date
    // (from the stock item's own stock_in_transaction, when it has one — a Break Set/Recovery
    // piece has none) and print history (times printed / last printed, same
    // findRecentByQrIds join the DUPLICATE state already uses for the same purpose).
    async _resolveInwardAndPrintInfo(activeRow, context) {
        const [inward, printEvents] = await Promise.all([
            context.stockInTransactionId
                ? this._stockInTransactionRepository.findByIdWithContext(db, context.stockInTransactionId)
                : Promise.resolve(null),
            this._printJobItemRepository.findRecentByQrIds(db, [activeRow.id], null),
        ]);

        const lastPrinted = printEvents.reduce((latest, row) => {
            if (!row.printedAt) return latest;
            if (!latest || new Date(row.printedAt) > new Date(latest.printedAt)) return row;
            return latest;
        }, null);

        return {
            inwardBatch: inward?.challanNo ?? null,
            inwardDate: inward?.stockDate ?? null,
            timesPrinted: printEvents.length,
            lastPrintedAt: lastPrinted?.printedAt ?? null,
        };
    }

    async _resolvePieceState(activeRow, context) {
        let origin = "LOOSE_RECEIVED";
        let originReason = null;
        let parent = null;

        if (context.originSetStockItemId) {
            origin = "SET_BREAK";
            const parentRows = await this._stockItemQrRepository.findByStockItemIds(db, [context.originSetStockItemId]);
            if (parentRows.length > 0) {
                const latestParentRow = parentRows[0]; // newest first
                parent = { shortCode: latestParentRow.shortCode, stockItemId: context.originSetStockItemId };
                originReason = latestParentRow.retiredReason ?? null;
            }
        }

        const { inwardBatch, inwardDate, timesPrinted, lastPrintedAt } = await this._resolveInwardAndPrintInfo(activeRow, context);

        return {
            state: "PIECE",
            piece: {
                shortCode: activeRow.shortCode,
                stockItemId: context.stockItemId,
                design: designView(context),
                variant: variantView(context),
                sizeLabel: context.sizeLabel ?? null,
                looseDays: daysSince(activeRow.generatedAt),
                bin: context.binId ? { id: context.binId, code: context.binCode } : null,
                origin,
                originReason,
                parent,
                inwardBatch,
                inwardDate,
                timesPrinted,
                lastPrintedAt,
            },
        };
    }

    async _resolveRetiredState(latestRow) {
        const successors = await this._stockItemRepository.findSuccessorsByOriginId(db, latestRow.stockItemId);

        return {
            state: "RETIRED",
            retired: {
                shortCode: latestRow.shortCode,
                stockItemId: latestRow.stockItemId,
                retiredAt: latestRow.retiredAt,
                retiredReason: latestRow.retiredReason,
                successors: successors.map((row) => ({
                    shortCode: row.shortCode,
                    stockItemId: row.stockItemId,
                    sizeLabel: row.sizeLabel,
                })),
            },
        };
    }

    // === 1b. Tag search ======================================================================

    // QR Center's main search box + filters: every ACTIVE tag matching a free-text keyword
    // and/or design/variant/type/age, as a paginated multi-result list — the counterpart to
    // resolve() above, which only ever returns a single exact-code match.
    async searchTags({ keyword, designId, colorVariantId, type, days, page, limit }) {
        const offset = (page - 1) * limit;
        const [rows, total] = await Promise.all([
            this._stockItemQrRepository.searchActive(db, { keyword, designId, colorVariantId, type, days, limit, offset }),
            this._stockItemQrRepository.countActive(db, { keyword, designId, colorVariantId, type, days }),
        ]);

        return {
            data: rows.map((row) => ({
                shortCode: row.shortCode,
                // The readable id printed on the label; null until the tag has a serial.
                displayCode: buildDisplayCode(row),
                stockItemId: row.stockItemId,
                stockItemQrId: row.id,
                type: row.type,
                design: { id: row.designId, code: row.designCode, name: row.designName },
                variant: { id: row.colorVariantId, colorName: row.colorName, colorHex: row.colorHex },
                sizeLabel: row.sizeLabel,
                rack: row.rackId ? { id: row.rackId, code: row.rackCode } : null,
                bin: row.binId ? { id: row.binId, code: row.binCode } : null,
                challanNo: row.challanNo,
                stockDate: row.stockDate,
                generatedAt: row.generatedAt,
            })),
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    // === 2. Health ===========================================================================

    async getHealth() {
        const [untaggedRows, reprintsPending, staleSummary, duplicateSuspectCount, unverifiedPrintJobs] = await Promise.all([
            this._stockInTransactionRepository.findUntaggedRegistrations(db, { limit: BULK_SAFETY_CAP, offset: 0 }),
            this._reprintRequestRepository.countByStatus(db, "PENDING"),
            this._stockItemQrRepository.findStaleSummaryByDesign(db),
            this._stockItemQrRepository.countDuplicateSuspects(db),
            this._printJobRepository.countByStatus(db, "COMPLETED_UNVERIFIED"),
        ]);

        const untaggedBatches = untaggedRows.length;
        const untaggedPieces = untaggedRows.reduce((sum, row) => sum + row.looseCount, 0);
        const staleTagCount = staleSummary.reduce((sum, row) => sum + row.staleCount, 0);

        return { untaggedBatches, untaggedPieces, reprintsPending, staleTagCount, duplicateSuspectCount, unverifiedPrintJobs };
    }

    // === 3. To-tag ===========================================================================

    async listToTag({ page, limit }) {
        const offset = (page - 1) * limit;
        const [rows, total] = await Promise.all([
            this._stockInTransactionRepository.findUntaggedRegistrations(db, { limit, offset }),
            this._stockInTransactionRepository.countUntaggedRegistrations(db),
        ]);

        return {
            data: rows.map((row) => ({
                source: row.challanNo || `ST-${row.stockInTransactionId}`,
                note: row.challanNo ? null : "skipped at Stock In",
                design: { id: row.designId, code: row.designCode, name: row.designName },
                variant: { id: row.colorVariantId, colorName: row.colorName, colorHex: row.colorHex },
                sets: row.eligibleItemCount - row.qrGeneratedCount,
                loose: row.looseCount,
                ageDays: daysSince(row.stockDate),
                // Untagged stock hasn't been placed on a rack yet — location is only assigned at
                // QR-generation/tagging time (see stockItems.schema.js rackId comment).
                location: null,
                stockInTransactionId: row.stockInTransactionId,
            })),
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    // === 4. Reprints =========================================================================

    async listReprints({ status, page, limit }) {
        const offset = (page - 1) * limit;
        const [rows, total] = await Promise.all([
            this._reprintRequestRepository.findManyWithContext(db, { status, limit, offset }),
            this._reprintRequestRepository.countByStatus(db, status),
        ]);

        return {
            data: rows.map((row) => this._toReprintView(row)),
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    _toReprintView(row) {
        return {
            id: row.id,
            stockItemId: row.stockItemId,
            stockItemQrId: row.stockItemQrId ?? null,
            shortCode: row.shortCode ?? null,
            design: { id: row.designId, code: row.designCode, name: row.designName },
            variant: { id: row.colorVariantId, colorName: row.colorName, colorHex: row.colorHex },
            reasonCode: row.reasonCode,
            raisedBy: row.raisedBy,
            rack: row.rackId ? { id: row.rackId, code: row.rackCode } : null,
            ageDays: daysSince(row.createdAt),
            status: row.status,
        };
    }

    async createReprintRequest({ stockItemId, reasonCode, raisedBy, rackId }) {
        return db.transaction(async (tx) => {
            const item = await this._stockItemRepository.findById(tx, stockItemId);
            if (!item) throw new ApiError(`Stock item ${stockItemId} not found.`, 404, "STOCK_ITEM_NOT_FOUND");

            const created = await this._reprintRequestRepository.create(tx, {
                stockItemId,
                reasonCode,
                raisedBy,
                rackId: rackId ?? null,
            });

            const withContext = await this._reprintRequestRepository.findByIdWithContext(tx, created.id);
            return this._toReprintView(withContext);
        });
    }

    // Bulk "Print batch" — mints one fresh stockItemQr row per reprinted item (same shortCode,
    // new generation event; see stockItemQr.schema.js), never retiring the prior row: a reprint
    // is the same logical code reprinted, not a new identity.
    async bulkPrintReprints({ reprintRequestIds, printerId }) {
        return db.transaction(async (tx) => {
            const printerRow = await this._printerRepository.findById(tx, printerId);
            if (!printerRow) throw new ApiError(`Printer ${printerId} not found.`, 404, "PRINTER_NOT_FOUND");

            const requests = await this._reprintRequestRepository.findByIds(tx, reprintRequestIds);
            const pending = requests.filter((row) => row.status === "PENDING");
            if (pending.length === 0) {
                throw new ApiError("No pending reprint requests found for the given ids.", 400, "NO_PENDING_REPRINTS");
            }

            const existingQrRows = await this._stockItemQrRepository.findByStockItemIds(tx, pending.map((row) => row.stockItemId));
            const latestActiveByStockItemId = new Map();
            for (const row of existingQrRows) {
                if (row.status !== "ACTIVE") continue;
                if (!latestActiveByStockItemId.has(row.stockItemId)) latestActiveByStockItemId.set(row.stockItemId, row);
            }

            const reprintable = pending.filter((row) => latestActiveByStockItemId.has(row.stockItemId));
            const newQrRows = reprintable.map((row) => {
                const prior = latestActiveByStockItemId.get(row.stockItemId);
                return {
                    stockItemId: row.stockItemId,
                    payload: prior.payload,
                    shortCode: prior.shortCode,
                    status: "ACTIVE",
                    priceSnapshot: prior.priceSnapshot,
                };
            });
            const createdQrRows = await this._stockItemQrRepository.createMany(tx, newQrRows);

            const printJob = await this._printJobRepository.create(tx, {
                printerId,
                jobType: "REPRINT",
                status: "COMPLETED",
                totalCount: createdQrRows.length,
                createdBy: null,
            });

            await this._printJobItemRepository.createMany(tx, createdQrRows.map((row, index) => ({
                printJobId: printJob.id,
                stockItemQrId: row.id,
                sequence: index + 1,
                printedAt: new Date(),
            })));

            await this._reprintRequestRepository.markPrinted(tx, reprintable.map((row) => row.id));

            return { printJob, reprintedCount: createdQrRows.length };
        });
    }

    // === 5. Stale ============================================================================

    async listStale() {
        const rows = await this._stockItemQrRepository.findStaleSummaryByDesign(db);
        return {
            data: rows.map((row) => ({
                designId: row.designId,
                designCode: row.designCode,
                currentPrice: toMoneyString(row.currentPrice),
                staleCount: row.staleCount,
                onHandCount: row.onHandCount,
            })),
        };
    }

    async staleReprint({ designId, scope }) {
        return db.transaction(async (tx) => {
            const designRow = await this._designRepository.findById(tx, designId);
            if (!designRow) throw new ApiError(`Design ${designId} not found.`, 404, "DESIGN_NOT_FOUND");

            const staleRows = await this._stockItemQrRepository.findStaleByDesign(tx, designId, { onHandOnly: scope === "ON_HAND" });
            if (staleRows.length === 0) {
                throw new ApiError(`No stale tags found for design ${designId} (scope ${scope}).`, 400, "NO_STALE_TAGS");
            }

            const freshPrice = toMoneyString(designRow.defaultSellingPricePerPiece);
            const newQrRows = staleRows.map((row) => ({
                stockItemId: row.stockItemId,
                payload: row.payload,
                shortCode: row.shortCode,
                status: "ACTIVE",
                priceSnapshot: freshPrice,
            }));
            const createdQrRows = await this._stockItemQrRepository.createMany(tx, newQrRows);

            const printJob = await this._printJobRepository.create(tx, {
                printerId: null,
                jobType: "REPRINT",
                status: "COMPLETED",
                totalCount: createdQrRows.length,
                createdBy: null,
            });

            await this._printJobItemRepository.createMany(tx, createdQrRows.map((row, index) => ({
                printJobId: printJob.id,
                stockItemQrId: row.id,
                sequence: index + 1,
                printedAt: new Date(),
            })));

            return { printJob, reprintedCount: createdQrRows.length };
        });
    }

    async staleAccept({ designId }) {
        return db.transaction(async (tx) => {
            const designRow = await this._designRepository.findById(tx, designId);
            if (!designRow) throw new ApiError(`Design ${designId} not found.`, 404, "DESIGN_NOT_FOUND");

            const acceptedCount = await this._stockItemQrRepository.acceptStaleByDesign(tx, designId);
            return { acceptedCount };
        });
    }

    // === 6. Recovery =========================================================================

    async listRecovery({ status }) {
        const rows = await this._recoveryEntryRepository.findMany(db, { status });
        return {
            data: rows.map((row) => ({
                id: row.id,
                status: row.status,
                foundLocation: row.foundLocation,
                notes: row.notes,
                createdAt: row.createdAt,
            })),
        };
    }

    async createRecovery({ foundLocation, notes }) {
        return this._recoveryEntryRepository.create(db, {
            foundLocation: foundLocation ?? null,
            notes: notes ?? null,
            status: "PENDING",
        });
    }

    // The deliberate, real duplicate-producing path (see recoveryEntry.schema.js) — an operator
    // can assign an EXISTING shortCode to a second, newly-created physical stock item rather than
    // minting a fresh one, which is exactly what the Resolver's DUPLICATE result exists to catch
    // afterward. Gated on supervisorName + acknowledged for the same reason: this is deliberate
    // UI friction around the one flow in this app that can genuinely corrupt QR uniqueness.
    async assignRecoveryIdentity(id, { designId, colorVariantId, rackId, supervisorName, acknowledged, claimShortCode }) {
        return db.transaction(async (tx) => {
            const entry = await this._recoveryEntryRepository.findById(tx, id);
            if (!entry) throw new ApiError(`Recovery entry ${id} not found.`, 404, "RECOVERY_ENTRY_NOT_FOUND");
            if (entry.status === "ASSIGNED") {
                throw new ApiError(`Recovery entry ${id} has already been assigned.`, 400, "RECOVERY_ENTRY_ALREADY_ASSIGNED");
            }

            const variant = await this._colorVariantRepository.findActiveById(tx, colorVariantId);
            if (!variant || variant.designId !== designId) {
                throw new ApiError(`Color variant ${colorVariantId} not found for design ${designId}.`, 404, "VARIANT_NOT_FOUND");
            }

            // A recovered anonymous find is always treated as an individually-tagged PIECE —
            // never a sealed SET, which can only come from Stock In or assembly.
            const pieceGroup = await this._stockGroupRepository.findOrCreate(tx, { colorVariantId, type: "PIECE" });
            const [createdItem] = await this._stockItemRepository.createMany(tx, [{
                stockGroupId: pieceGroup.id,
                colorVariantId,
                designSizeId: null,
                stockInTransactionId: null,
                bundleId: null,
                type: "PIECE",
                status: "AVAILABLE",
                rackId: rackId ?? null,
            }]);

            let qrRow;
            if (claimShortCode) {
                const existingRows = await this._stockItemQrRepository.findByShortCode(tx, claimShortCode);
                if (existingRows.length === 0) {
                    throw new ApiError(`No existing QR found for code ${claimShortCode} to claim.`, 404, "CLAIM_SHORT_CODE_NOT_FOUND");
                }
                const template = existingRows[0];
                qrRow = await this._stockItemQrRepository.create(tx, {
                    stockItemId: createdItem.id,
                    payload: template.payload,
                    shortCode: claimShortCode,
                    status: "ACTIVE",
                    priceSnapshot: template.priceSnapshot,
                });
            } else {
                const shortCode = await generateUniqueShortCode((candidate) => this._stockItemQrRepository.existsActiveShortCode(tx, candidate));
                qrRow = await this._stockItemQrRepository.create(tx, {
                    stockItemId: createdItem.id,
                    payload: this._stockQrService.buildPayload({
                        designCode: variant.designCode,
                        designName: variant.designName,
                        colorName: variant.colorName,
                        stockItemId: createdItem.id,
                    }),
                    shortCode,
                    status: "ACTIVE",
                    priceSnapshot: null,
                });
            }

            const updatedEntry = await this._recoveryEntryRepository.assign(tx, id, {
                assignedStockItemId: createdItem.id,
                supervisorName,
                acknowledged,
            });

            return { recoveryEntry: updatedEntry, stockItem: createdItem, stockItemQr: qrRow };
        });
    }

    // === 7. Jobs =============================================================================

    async listJobs({ status, page, limit }) {
        const offset = (page - 1) * limit;
        const [rows, total] = await Promise.all([
            this._printJobRepository.findMany(db, { status, limit, offset }),
            this._printJobRepository.count(db, { status }),
        ]);

        return {
            data: rows.map((row) => ({
                id: row.id,
                jobType: row.jobType,
                printer: row.printerId ? { id: row.printerId, name: row.printerName } : null,
                totalCount: row.totalCount,
                jammedAtCount: row.jammedAtCount,
                status: row.status,
                createdBy: row.createdBy,
                createdAt: row.createdAt,
            })),
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async reprintJobRange(jobId, { fromSeq, toSeq }) {
        return db.transaction(async (tx) => {
            const job = await this._printJobRepository.findById(tx, jobId);
            if (!job) throw new ApiError(`Print job ${jobId} not found.`, 404, "PRINT_JOB_NOT_FOUND");

            const items = await this._printJobItemRepository.findByJobIdAndSeqRange(tx, jobId, fromSeq, toSeq);
            if (items.length === 0) {
                throw new ApiError(`No items found in job ${jobId} for sequence range ${fromSeq}-${toSeq}.`, 400, "NO_ITEMS_IN_RANGE");
            }

            const newQrRows = items.map((item) => ({
                stockItemId: item.stockItemId,
                payload: item.payload,
                shortCode: item.shortCode,
                status: "ACTIVE",
                priceSnapshot: item.priceSnapshot,
            }));
            const createdQrRows = await this._stockItemQrRepository.createMany(tx, newQrRows);

            const newJob = await this._printJobRepository.create(tx, {
                printerId: job.printerId,
                jobType: job.jobType,
                status: "COMPLETED",
                totalCount: createdQrRows.length,
                createdBy: job.createdBy,
            });

            await this._printJobItemRepository.createMany(tx, createdQrRows.map((row, index) => ({
                printJobId: newJob.id,
                stockItemQrId: row.id,
                sequence: index + 1,
                printedAt: new Date(),
            })));

            return { printJob: newJob };
        });
    }

    async verifyJobSample(jobId) {
        return db.transaction(async (tx) => {
            const updated = await this._printJobRepository.verify(tx, jobId);
            if (updated) return updated;

            const current = await this._printJobRepository.findById(tx, jobId);
            if (!current) throw new ApiError(`Print job ${jobId} not found.`, 404, "PRINT_JOB_NOT_FOUND");
            if (current.status === "COMPLETED") return current; // idempotent

            throw new ApiError(`Print job ${jobId} is not in COMPLETED_UNVERIFIED status.`, 400, "PRINT_JOB_NOT_UNVERIFIED");
        });
    }

    // === 8. Break set ========================================================================

    // Same break as Stock Transformation's "Break a set" (one implementation, so both screens
    // agree on what a broken set means), with every piece going back to stock: the set leaves
    // stock, its parent tag is retired, and its pieces become loose, individually-tagged stock.
    async breakSet({ stockItemId, reasonCode, note }) {
        const result = await stockTransformationService.breakUnit({ unitStockItemId: stockItemId, destinations: null, reason: reasonCode, note });
        return {
            retiredShortCode: result.retiredShortCode,
            successors: result.pieces.map((piece) => ({ shortCode: piece.code, sizeLabel: piece.size, stockItemId: piece.stockItemId })),
        };
    }

    // A BUNDLE stock item's own composition (semi-set aware) — falls back to the variant's
    // full setSizes only if this BUNDLE has no stock_in_bundle_pieces row (defensive; every
    // BUNDLE created via Stock-In always has one).
    async _buildBundleSizeEntries(tx, context, setSizes) {
        if (!context.bundleId) return setSizes.map((size) => ({ designSizeId: size.id, sizeLabel: size.sizeLabel, unsetPricePerSize: size.unsetPricePerSize }));

        const pieces = await this._stockInBundlePieceRepository.findByBundleId(tx, context.bundleId);
        if (pieces.length === 0) return setSizes.map((size) => ({ designSizeId: size.id, sizeLabel: size.sizeLabel, unsetPricePerSize: size.unsetPricePerSize }));

        return pieces.flatMap((piece) => {
            const size = setSizes.find((candidate) => candidate.id === piece.designSizeId);
            const entry = { designSizeId: piece.designSizeId, sizeLabel: size?.sizeLabel ?? "", unsetPricePerSize: size?.unsetPricePerSize ?? null };
            return Array(piece.quantity).fill(entry);
        });
    }

    // === 9. Bulk generators ==================================================================

    async runBulkGenerator(kind, body) {
        switch (kind) {
            case "migration-run": return this._bulkMigrationRun(body);
            case "rack-bin-labels": return this._bulkRackBinLabels(body);
            case "rebag-rack": return this._bulkRebagRack(body);
            case "tour-manifest": return this._bulkTourManifest(body);
            case "void-labels": return this._bulkVoidLabels(body);
            default: throw new ApiError(`Unknown bulk generator kind: ${kind}.`, 400, "UNKNOWN_BULK_KIND");
        }
    }

    // Deviation from the contract doc's "legacy racks" scoping: this schema has no notion of a
    // legacy rack (racks are a flat, undifferentiated table — see rack.schema.js), so this
    // targets every currently untagged SET/BUNDLE stock item network-wide instead.
    async _bulkMigrationRun({ printerId }) {
        if (!printerId) throw new ApiError("printerId is required.", 400, "PRINTER_ID_REQUIRED");

        return db.transaction(async (tx) => {
            const printerRow = await this._printerRepository.findById(tx, printerId);
            if (!printerRow) throw new ApiError(`Printer ${printerId} not found.`, 404, "PRINTER_NOT_FOUND");

            const untaggedIds = await this._stockItemRepository.findUntaggedIds(tx, { limit: BULK_SAFETY_CAP });
            if (untaggedIds.length === 0) throw new ApiError("No untagged stock found to migrate.", 400, "NOTHING_TO_MIGRATE");

            const generated = await this._generateQrRowsForStockItemIds(tx, untaggedIds.map((row) => row.stockItemId));
            if (generated.length === 0) throw new ApiError("No untagged stock found to migrate.", 400, "NOTHING_TO_MIGRATE");

            const printJob = await this._printJobRepository.create(tx, {
                printerId,
                jobType: "QR_GENERATE",
                status: "COMPLETED",
                totalCount: generated.length,
                createdBy: null,
            });

            await this._printJobItemRepository.createMany(tx, generated.map((row, index) => ({
                printJobId: printJob.id,
                stockItemQrId: row.id,
                sequence: index + 1,
                printedAt: new Date(),
            })));

            return { printJob };
        });
    }

    async _bulkRackBinLabels({ printerId }) {
        if (!printerId) throw new ApiError("printerId is required.", 400, "PRINTER_ID_REQUIRED");

        return db.transaction(async (tx) => {
            const printerRow = await this._printerRepository.findById(tx, printerId);
            if (!printerRow) throw new ApiError(`Printer ${printerId} not found.`, 404, "PRINTER_NOT_FOUND");

            const [racks, bins] = await Promise.all([
                this._rackRepository.findAll(tx),
                this._binRepository.findAll(tx),
            ]);
            const totalCount = racks.length + bins.length;
            if (totalCount === 0) throw new ApiError("No racks or bins found to label.", 400, "NOTHING_TO_LABEL");

            const printJob = await this._printJobRepository.create(tx, {
                printerId,
                jobType: "RACK_BIN_LABEL",
                status: "COMPLETED",
                totalCount,
                createdBy: null,
            });

            return { printJob };
        });
    }

    async _bulkRebagRack({ rackId, printerId }) {
        if (!rackId) throw new ApiError("rackId is required.", 400, "RACK_ID_REQUIRED");
        if (!printerId) throw new ApiError("printerId is required.", 400, "PRINTER_ID_REQUIRED");

        return db.transaction(async (tx) => {
            const rackRow = await this._rackRepository.findById(tx, rackId);
            if (!rackRow) throw new ApiError(`Rack ${rackId} not found.`, 404, "RACK_NOT_FOUND");

            const printerRow = await this._printerRepository.findById(tx, printerId);
            if (!printerRow) throw new ApiError(`Printer ${printerId} not found.`, 404, "PRINTER_NOT_FOUND");

            const activeQrs = await this._stockItemQrRepository.findActiveByRackId(tx, rackId);
            if (activeQrs.length === 0) throw new ApiError(`No tagged stock found in rack ${rackId} to rebag.`, 400, "NOTHING_TO_REBAG");

            const createdQrRows = await this._stockItemQrRepository.createMany(tx, activeQrs.map((row) => ({
                stockItemId: row.stockItemId,
                payload: row.payload,
                shortCode: row.shortCode,
                status: "ACTIVE",
                priceSnapshot: row.priceSnapshot,
            })));

            const printJob = await this._printJobRepository.create(tx, {
                printerId,
                jobType: "REPRINT",
                status: "COMPLETED",
                totalCount: createdQrRows.length,
                createdBy: null,
            });

            await this._printJobItemRepository.createMany(tx, createdQrRows.map((row, index) => ({
                printJobId: printJob.id,
                stockItemQrId: row.id,
                sequence: index + 1,
                printedAt: new Date(),
            })));

            return { printJob };
        });
    }

    async _bulkTourManifest({ stockItemIds }) {
        if (!Array.isArray(stockItemIds) || stockItemIds.length === 0) {
            throw new ApiError("stockItemIds is required.", 400, "STOCK_ITEM_IDS_REQUIRED");
        }

        return db.transaction(async (tx) => {
            const items = await this._stockItemRepository.findByIds(tx, stockItemIds);
            if (items.length === 0) throw new ApiError("None of the given stock items were found.", 404, "STOCK_ITEMS_NOT_FOUND");

            const activeQrs = await this._stockItemQrRepository.findByStockItemIds(tx, items.map((item) => item.id));
            const latestActiveByItem = new Map();
            for (const row of activeQrs) {
                if (row.status !== "ACTIVE") continue;
                if (!latestActiveByItem.has(row.stockItemId)) latestActiveByItem.set(row.stockItemId, row);
            }

            const qrRowsInOrder = stockItemIds.map((id) => latestActiveByItem.get(id)).filter(Boolean);
            if (qrRowsInOrder.length === 0) {
                throw new ApiError("None of the given stock items have an active QR to manifest.", 400, "NO_ACTIVE_QR_FOR_MANIFEST");
            }

            const printJob = await this._printJobRepository.create(tx, {
                printerId: null,
                jobType: "TOUR_MANIFEST",
                status: "COMPLETED",
                totalCount: qrRowsInOrder.length,
                createdBy: null,
            });

            await this._printJobItemRepository.createMany(tx, qrRowsInOrder.map((row, index) => ({
                printJobId: printJob.id,
                stockItemQrId: row.id,
                sequence: index + 1,
                printedAt: new Date(),
            })));

            return { printJob };
        });
    }

    async _bulkVoidLabels({ stockInTransactionId, printerId }) {
        if (!stockInTransactionId) throw new ApiError("stockInTransactionId is required.", 400, "STOCK_IN_TRANSACTION_ID_REQUIRED");
        if (!printerId) throw new ApiError("printerId is required.", 400, "PRINTER_ID_REQUIRED");

        return db.transaction(async (tx) => {
            const printerRow = await this._printerRepository.findById(tx, printerId);
            if (!printerRow) throw new ApiError(`Printer ${printerId} not found.`, 404, "PRINTER_NOT_FOUND");

            const items = await this._stockItemRepository.findByStockInTransactionId(tx, stockInTransactionId);
            if (items.length === 0) {
                throw new ApiError(`Stock-in transaction ${stockInTransactionId} not found or has no stock items.`, 404, "STOCK_IN_TRANSACTION_NOT_FOUND");
            }

            let retiredCount = 0;
            for (const item of items) {
                const retired = await this._stockItemQrRepository.retireActiveByStockItemId(tx, item.id, { retiredReason: "VOID" });
                retiredCount += retired.length;
            }
            if (retiredCount === 0) {
                throw new ApiError(`No active QR labels found for stock-in transaction ${stockInTransactionId} to void.`, 400, "NOTHING_TO_VOID");
            }

            const printJob = await this._printJobRepository.create(tx, {
                printerId,
                jobType: "VOID",
                status: "COMPLETED",
                totalCount: retiredCount,
                createdBy: null,
            });

            return { printJob };
        });
    }

    // === 10. Print-check =====================================================================

    async printCheck({ stockItemQrIds }) {
        const since = new Date(Date.now() - PRINT_CHECK_WINDOW_MS);
        const matches = await this._printJobItemRepository.findRecentByQrIds(db, stockItemQrIds, since);

        return {
            recentMatches: matches.map((row) => ({
                stockItemQrId: row.stockItemQrId,
                printJobId: row.printJobId,
                printedBy: row.printedBy,
                printedAt: row.printedAt,
            })),
            matchedCount: matches.length,
        };
    }

    // === 11. Reference =======================================================================

    async getReference() {
        const [printers, tagPresets, racks] = await Promise.all([
            this._printerRepository.findAllActive(db),
            this._tagPresetRepository.findAllWithContext(db),
            this._rackRepository.findAll(db),
        ]);

        return {
            printers: printers.map((row) => ({ id: row.id, name: row.name, location: row.location, isActive: row.isActive })),
            reasonCodes: REASON_CODES,
            permissions: PERMISSIONS,
            tagPresets: tagPresets.map((row) => ({
                designId: row.designId,
                designCode: row.designCode,
                presetName: row.presetName,
                mediaSize: row.mediaSize,
                defaultPrinter: row.defaultPrinterName ?? null,
            })),
            racks: racks.map((row) => ({ id: row.id, code: row.code, label: row.label })),
        };
    }
}

export default new QrCenterService();
