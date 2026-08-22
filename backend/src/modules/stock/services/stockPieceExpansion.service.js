import stockGroupRepository from "../repositories/stockGroup.repository.js";
import stockItemRepository from "../repositories/stockItem.repository.js";
import stockItemQrRepository from "../repositories/stockItemQr.repository.js";
import stockQrService from "./stockQr.service.js";

// Expands a composition (one entry per physical piece a SET/BUNDLE contains — for a SET,
// every full-set size once; for a BUNDLE, that bundle's own sizes, each repeated by its own
// quantity) into individually-tagged PIECE stock items + ACTIVE QR rows, all sharing the
// variant's single PIECE stock_group (see stock_groups_piece_unique_idx).
//
// `sizeEntries`: [{ designSizeId, sizeLabel, unsetPricePerSize }, ...] — one entry PER
// PHYSICAL PIECE, already expanded by quantity (a 2-of-this-size bundle passes that size
// twice). `originSetStockItemId`: the SET/BUNDLE stock item this piece came from, or `null`
// for a piece tagged directly from loose stock (no parent to point back to). `insideParent`:
// true when the piece is a child tag that stays INSIDE that set (Stock In Parent+Child tagging),
// false when the set is being broken and the piece becomes loose.
class StockPieceExpansionService {
    _stockGroupRepository = stockGroupRepository;
    _stockItemRepository = stockItemRepository;
    _stockItemQrRepository = stockItemQrRepository;
    _stockQrService = stockQrService;

    async createPiecesForComposition(tx, { sizeEntries, originSetStockItemId, insideParent = false, ...shared }) {
        return this.createPiecesForCompositions(tx, { ...shared, compositions: [{ sizeEntries, originSetStockItemId, insideParent }] });
    }

    // Several compositions of one colour variant at once — e.g. every set of a Stock In — in a
    // fixed handful of queries (one insert for all pieces, one code check, one insert for all QR
    // rows) however many pieces there are. Results come back in input order, composition by
    // composition.
    async createPiecesForCompositions(tx, { colorVariantId, compositions, stockInTransactionId = null, designCode, designName, colorName }) {
        const pieces = compositions.flatMap(({ sizeEntries, originSetStockItemId, insideParent = false }) =>
            sizeEntries.map((size) => ({ size, originSetStockItemId, insideParent })));
        if (pieces.length === 0) return [];

        const pieceGroup = await this._stockGroupRepository.findOrCreate(tx, { colorVariantId, type: "PIECE" });

        // A multi-row INSERT ... RETURNING gives rows back in VALUES order, so createdItems[i] is pieces[i].
        const createdItems = await this._stockItemRepository.createMany(tx, pieces.map(({ size, originSetStockItemId, insideParent }) => ({
            stockGroupId: pieceGroup.id,
            colorVariantId,
            designSizeId: size.designSizeId,
            stockInTransactionId,
            bundleId: null,
            type: "PIECE",
            status: "AVAILABLE",
            originSetStockItemId,
            parentStockItemId: insideParent ? originSetStockItemId : null,
        })));

        const shortCodes = await this._stockQrService.uniqueShortCodes(tx, createdItems.length);
        const qrRows = await this._stockItemQrRepository.createMany(tx, createdItems.map((item, index) => ({
            stockItemId: item.id,
            payload: this._stockQrService.buildPayload({ designCode, designName, colorName, stockItemId: item.id }),
            shortCode: shortCodes[index],
            status: "ACTIVE",
            priceSnapshot: pieces[index].size.unsetPricePerSize,
        })));

        return createdItems.map((item, index) => ({ stockItem: item, qr: qrRows[index], sizeLabel: pieces[index].size.sizeLabel }));
    }
}

export default new StockPieceExpansionService();
