import { db } from "../../../database/index.js";
import ApiError from "../../../core/apiError.js";

import variantInventoryRepository from "../../inventory/repositories/variantInventory.repository.js";

import stockInValidator from "./stockInValidator.service.js";
import stockInCalculatorService from "./stockInCalculator.service.js";
import stockInPersistence from "./stockInPersistence.service.js";
import stockInResultMapper from "../mapper/stockInResultMapper.js";
import stockQrService from "./stockQr.service.js";
import variantSerialCounterRepository from "../repositories/variantSerialCounter.repository.js";
import stockHistoryService from "./stockHistory.service.js";
import printJobRepository from "../repositories/printJob.repository.js";
import printJobItemRepository from "../repositories/printJobItem.repository.js";
import stockInDraftRepository from "../repositories/stockInDraft.repository.js";
import stockInChallanRepository from "../repositories/stockInChallan.repository.js";
import { formatSerial } from "./stockInChallan.service.js";

function todayAsIsoDate() {
    return new Date().toISOString().slice(0, 10);
}

// Snapshot of what this Stock In actually added, for the STOCK_IN history event's metadata —
// built from the same `delta`/`createdBundles`/`variantInput` already computed for persistence,
// never re-derived from stock_items/variant_inventory afterwards.
function buildStockInHistoryMetadata({ delta, variantInput, createdBundles }) {
    const sizeBreakdown = [...delta.entries()]
        .filter(([, quantity]) => quantity > 0)
        .map(([designSizeId, quantityAdded]) => ({ designSizeId, quantityAdded }));

    // createdBundles preserves the same order as variantInput.bundles (see
    // stockInPersistence.service.js's _saveBundles), so composition can be zipped back in by
    // index — createdBundles itself only carries the persisted bundleNumber/quantity columns.
    const bundles = (variantInput.bundles ?? []).map((bundle, index) => ({
        bundleNumber: createdBundles[index].bundleNumber,
        quantity: createdBundles[index].quantity,
        composition: bundle.composition.map((piece) => ({ designSizeId: piece.designSizeId, quantity: piece.quantity })),
    }));

    const loosePieces = (variantInput.loosePieces ?? []).map((piece) => ({
        designSizeId: piece.designSizeId,
        quantity: piece.quantity,
    }));

    return {
        sizeBreakdown,
        totalSetsReceived: variantInput.totalSetsReceived ?? 0,
        bundles,
        loosePieces,
    };
}

// SET: every active size for the variant currently has inventory > 0 (sellable as a complete matched set).
function computeStatus(activeSizes, qtyMap) {
    return activeSizes.every((size) => (qtyMap.get(size.id) ?? 0) > 0) ? "SET" : "UNSET";
}

class StockInService {

    _variantInventoryRepository = variantInventoryRepository;
    _stockInValidator = stockInValidator;
    _stockInCalculator = stockInCalculatorService;
    _stockInPersistence = stockInPersistence;
    _stockQrService = stockQrService;
    _stockHistoryService = stockHistoryService;
    _printJobRepository = printJobRepository;
    _printJobItemRepository = printJobItemRepository;
    _variantSerialCounterRepository = variantSerialCounterRepository;
    _stockInDraftRepository = stockInDraftRepository;
    _stockInChallanRepository = stockInChallanRepository;

    _stockInResultMapper = stockInResultMapper;

    // One request can register stock for many Color Variants across many Designs in a single
    // submission. Every variant gets its own StockInTransaction, but the whole request commits
    // or rolls back together as one atomic database transaction.
    async registerStockIn(data) {
        return db.transaction(async (tx) => {
            const { challan: challanInput } = data;

            // The same jobber can't deliver the same challan number twice — that is almost
            // always the same delivery entered again.
            const duplicate = await this._stockInChallanRepository.findActiveDuplicate(tx, {
                jobberName: challanInput.jobberName,
                challanNo: challanInput.challanNo,
            });
            if (duplicate) {
                throw new ApiError(`${challanInput.jobberName} already has challan ${challanInput.challanNo} (${formatSerial(duplicate.serial)}).`, 409, "DUPLICATE_CHALLAN");
            }

            // The serial is issued here — when the inward is actually completed — and only
            // moves forward, so a draft never uses one and a dropped challan never frees one.
            const serial = await this._stockInChallanRepository.issueNextSerial(tx);
            const challan = await this._stockInChallanRepository.create(tx, {
                serial,
                jobberName: challanInput.jobberName,
                challanNo: challanInput.challanNo,
                issuedChallanNo: challanInput.issuedChallanNo,
                stockDate: challanInput.stockDate,
                remarks: challanInput.remarks || null,
                defectAction: challanInput.defectAction,
                enteredBy: "Staff",
            });

            const variantResults = [];

            for (const design of data.designs) {
                for (const submitted of design.variants) {
                    const variantInput = { ...submitted, challanId: challan.id, stockDate: challan.stockDate, challanNo: challan.challanNo };
                    const result = await this._registerVariantStockIn(tx, design.designId, variantInput);
                    variantResults.push(result);
                }
            }

            // NEW: one print job for every QR issued across the whole request (SET/BUNDLE +
            // any individually-tagged PIECEs), only when the caller asked to print immediately
            // — see design spec decision 8 ("Send to printer" vs "Skip · send to QR Center").
            let printJobId = null;
            if (data.printOnConfirm) {
                const allQrIds = variantResults.flatMap((result) => result.qrIds ?? []);
                if (allQrIds.length > 0) {
                    const job = await this._printJobRepository.create(tx, {
                        printerId: data.printerId,
                        jobType: "QR_GENERATE",
                        status: "COMPLETED",
                        totalCount: allQrIds.length,
                    });
                    await this._printJobItemRepository.createMany(tx, allQrIds.map((stockItemQrId, index) => ({
                        printJobId: job.id,
                        stockItemQrId,
                        sequence: index + 1,
                    })));
                    printJobId = job.id;
                }
            }

            // The wizard draft this inward was resumed from (if any) is now fully registered —
            // removed in the same transaction so it can't linger on the dashboard, and restored
            // if registration rolls back. A draft already discarded elsewhere is not an error.
            if (data.draftId) {
                await this._stockInDraftRepository.deleteById(tx, data.draftId);
            }

            return {
                challan: { id: challan.id, serial: challan.serial, serialLabel: formatSerial(challan.serial) },
                transactionsCreated: variantResults.length,
                variants: variantResults,
                printJobId,
            };
        });
    }

    // `expectedStart` is what the Tag Studio printed on the labels; if another inward has moved the
    // counters since, the labels no longer match the saved serials, so the whole request rolls
    // back and the user reprints rather than getting two different numbers for one piece.
    async _assignSerials(tx, colorVariantId, expectedStart, { setItems, pieceItems }) {
        if (setItems.length === 0 && pieceItems.length === 0) return { sets: [], pieces: [] };

        const byId = (a, b) => a.id - b.id;
        const sets = [...setItems].sort(byId);
        const pieces = [...pieceItems].sort(byId);
        const start = await this._variantSerialCounterRepository.reserve(tx, colorVariantId, { sets: sets.length, pieces: pieces.length });

        const mismatch = (expectedStart?.set !== undefined && sets.length > 0 && expectedStart.set !== start.setStart)
            || (expectedStart?.piece !== undefined && pieces.length > 0 && expectedStart.piece !== start.pieceStart);
        if (mismatch) {
            throw new ApiError(
                "QR serial numbers for this design colour changed since the labels were generated. Go back to QR Tag Studio and print the labels again.",
                409,
                "QR_SERIAL_CHANGED"
            );
        }

        await this._variantSerialCounterRepository.assignSerials(tx, [
            ...sets.map((item, index) => ({ stockItemId: item.id, serialNo: start.setStart + index })),
            ...pieces.map((item, index) => ({ stockItemId: item.id, serialNo: start.pieceStart + index })),
        ]);

        return { sets: sets.length, pieces: pieces.length, ...start };
    }

    async getSerialCounters(colorVariantIds) {
        const rows = await this._variantSerialCounterRepository.findByVariantIds(db, colorVariantIds);
        const byId = new Map(rows.map((row) => [row.colorVariantId, row]));
        return colorVariantIds.map((colorVariantId) => ({
            colorVariantId,
            lastSetSerial: byId.get(colorVariantId)?.lastSetSerial ?? 0,
            lastPieceSerial: byId.get(colorVariantId)?.lastPieceSerial ?? 0,
        }));
    }

    async _registerVariantStockIn(tx, designId, variantInput) {
        // 1. Validate request and load required variant context
        const validateStockIn = await this._stockInValidator.validate(tx, designId, variantInput);

        // 2. delta: per size quantity to add by sets + bundle + loose piece
        const delta = this._stockInCalculator.calculateStockIn(validateStockIn.activeSizes, variantInput);

        // 3. create stock in transaction record
        const { transaction: stockInTransaction, createdBundles } = await this._stockInPersistence.createStockInTransaction(tx, validateStockIn.variant, variantInput);

        // 3.5 NEW: resolve (find-or-create) the stock groups this registration belongs to
        const setGroup = variantInput.totalSetsReceived > 0 ? await this._stockInPersistence.resolveSetGroup(tx, validateStockIn.variant.id) : null;
        // skip creating stock groups if there are no sets

        const bundleGroups = await this._stockInPersistence.resolveBundleGroups(tx, validateStockIn.variant.id, variantInput.bundles ?? []);
        const loosePieceGroups = await this._stockInPersistence.resolveLoosePieceGroups(tx, validateStockIn.variant.id, variantInput.loosePieces ?? []);

        // 3.6 NEW: create individual stock_items rows — unique IDs come from this insert
        const stockItems = await this._stockInPersistence.createStockItems(tx, {
            stockInTransactionId: stockInTransaction.id,
            colorVariantId: validateStockIn.variant.id,
            variantInput,
            setGroup,
            createdBundles,
            bundleGroups,
            loosePieceGroups,
        });

        // 3.7 NEW: generate + persist QR history for every SET/BUNDLE stock item just created
        const generatedQr = await this._stockQrService.generateForStockItems(tx, stockItems, {
            designCode: validateStockIn.variant.designCode,
            designName: validateStockIn.variant.designName,
            colorName: validateStockIn.variant.colorName,
        });

        // 3.8 NEW: individually-tagged PIECE stock items for Parent+Child / tag-loose-pieces —
        // zips stockItems back with createdBundles by matching each BUNDLE row's own bundleId,
        // since createStockItems doesn't stamp a bundle index onto the rows it returns.
        const setSizes = validateStockIn.activeSizes.filter((size) => size.includedInSet);
        const createdSetItems = stockItems.filter((item) => item.type === "SET");
        const createdBundleItems = stockItems
            .filter((item) => item.type === "BUNDLE")
            .map((item) => ({ ...item, bundleIndex: createdBundles.findIndex((bundle) => bundle.id === item.bundleId) }));
        const loosePieceEntries = variantInput.loosePieces ?? [];

        const taggedPieces = await this._stockInPersistence.createTaggedPieces(tx, {
            stockInTransactionId: stockInTransaction.id,
            colorVariantId: validateStockIn.variant.id,
            variantInput,
            setSizes,
            createdSetItems,
            createdBundleItems,
            loosePieceEntries,
            designCode: validateStockIn.variant.designCode,
            designName: validateStockIn.variant.designName,
            colorName: validateStockIn.variant.colorName,
        });

        // 3.9 NEW: running QR serials for this variant — sets/semi sets and tagged pieces each
        // continue after the last number ever issued for the variant (see variant_serial_counters).
        await this._assignSerials(tx, validateStockIn.variant.id, variantInput.serialStart, {
            setItems: stockItems.filter((item) => item.type === "SET" || item.type === "BUNDLE"),
            pieceItems: taggedPieces.map((row) => row.stockItem),
        });

        // 4. update current inventory
        const updatedInventory = await this._variantInventoryRepository.upsertIncrement(tx,
            this._variantInventoryRepository.buildIncrementRows(validateStockIn.variant.id, delta)
        );

        // 5. store normalized inventory ledger
        await this._stockInPersistence.createEntries(tx, stockInTransaction.id, validateStockIn.variant.id, delta);

        // 5.5 NEW: record the STOCK_IN history event — same tx, so it commits/rolls back with
        // everything above. No resultStockItemId/stockGroupId: a single Stock In can create many
        // stock items across multiple groups (sets + several bundle groups + loose groups), so
        // there is no single one that would be a non-arbitrary choice here.
        const totalQuantityAdded = [...delta.values()].reduce((sum, quantity) => sum + quantity, 0);
        await this._stockHistoryService.record(tx, "STOCK_IN", {
            colorVariantId: validateStockIn.variant.id,
            stockInTransactionId: stockInTransaction.id,
            quantity: totalQuantityAdded,
            metadata: { ...buildStockInHistoryMetadata({ delta, variantInput, createdBundles }), taggedPieceCount: taggedPieces.length },
        });

        // 6. build response
        return {
            ...this._stockInResultMapper.map({
                designId,
                variant: validateStockIn.variant,
                transaction: stockInTransaction,
                activeSizes: validateStockIn.activeSizes,
                delta,
                updatedInventory,
                variantInput,
                stockGroupId: setGroup?.id ?? null,
                stockItems
            }),
            // Every stock_item_qr id issued for this variant — SET/BUNDLE/LOOSE_PIECE's (via
            // generateForStockItems) plus every individually-tagged PIECE's (via
            // createTaggedPieces, which issues its own QR directly). registerStockIn (below)
            // collects these across all variants to build one print job when printOnConfirm.
            qrIds: [...generatedQr.map((row) => row.id), ...taggedPieces.map((row) => row.qr.id)],
        };
    }
}

export default new StockInService();
