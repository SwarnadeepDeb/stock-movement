import { db } from "../../../database/index.js";
import ApiError from "../../../core/apiError.js";

import colorVariantRepository from "../../design/repositories/colorVariant.repository.js";
import designSizeRepository from "../../design/repositories/designSize.repository.js";
import stockItemRepository from "../../stock/repositories/stockItem.repository.js";
import stockGroupRepository from "../../stock/repositories/stockGroup.repository.js";
import { parseBundleCompositionSignature } from "../../stock/services/stockInPersistence.service.js";
import variantInventoryRepository from "../repositories/variantInventory.repository.js";

const EMPTY_TOTALS = { setPieces: 0, bundlePieces: 0, loosePieces: 0, totalPieces: 0 };

class CurrentStockService {
    _colorVariantRepository = colorVariantRepository;
    _designSizeRepository = designSizeRepository;
    _stockItemRepository = stockItemRepository;
    _stockGroupRepository = stockGroupRepository;
    _variantInventoryRepository = variantInventoryRepository;

    // Summary: one row per Design, with its active Color Variants nested inside — mirrors
    // design.service.getAllDesigns's design-page + group-variants-in-JS pattern, so pagination/meta
    // count designs (not variants) and a design's variants can never be split across two pages.
    // Per-variant totalPieces comes straight from variant_inventory (already the current-total-
    // physical-pieces projection — see variantInventory.schema.js); this deliberately does not touch
    // stock_items/stock_groups or explode set/bundle composition — that breakdown belongs to the
    // separate Current Stock Detail API.
    async getCurrentStockSummary({ page, limit, keyword }) {
        const offset = (page - 1) * limit;

        const [designs, total] = await Promise.all([
            this._colorVariantRepository.findDesignsWithActiveVariants({ limit, offset, keyword }),
            this._colorVariantRepository.countDesignsWithActiveVariants({ keyword }),
        ]);

        const designIds = designs.map((design) => design.designId);
        const variants = await this._colorVariantRepository.findByDesignIds(designIds);

        const colorVariantIds = variants.map((variant) => variant.id);
        const totals = await this._variantInventoryRepository.sumQuantityByColorVariantIds(colorVariantIds);
        const totalPiecesByVariantId = new Map(totals.map((row) => [row.colorVariantId, row.totalPieces]));

        const variantsByDesignId = variants.reduce((acc, variant) => {
            // No variant_inventory rows yet (never received) → 0, not excluded — the Current
            // Stock table is expected to surface out-of-stock variants, not hide them.
            const totalPieces = totalPiecesByVariantId.get(variant.id) ?? 0;

            (acc[variant.designId] ??= []).push({
                colorVariantId: variant.id,
                colorName: variant.colorName,
                colorHex: variant.colorHex,
                imageUrl: variant.imageUrl,
                totalPieces,
                status: totalPieces > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
            });

            return acc;
        }, {});

        return {
            data: designs.map((design) => {
                const designVariants = variantsByDesignId[design.designId] ?? [];
                // Sum of variant pieces, never the variant count itself.
                const totalPieces = designVariants.reduce((sum, variant) => sum + variant.totalPieces, 0);

                return {
                    designId: design.designId,
                    designCode: design.designCode,
                    designName: design.designName,
                    // Representative thumbnail — same "first variant of the design" convention
                    // design.service uses for setComposition (every variant shares the same size set;
                    // here every variant's image represents the same design row).
                    imageUrl: designVariants[0]?.imageUrl ?? null,
                    variants: designVariants,
                    totalPieces,
                    status: totalPieces > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
                };
            }),
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // Detail breakdown for a Design + its Color Variants: physical pieces per size, split by
    // set/bundle/loose, per variant, plus a design-wide "Total" aggregate — so the Current Stock
    // Detail page can offer a Blue/Green/Gold/Total selector from a single request (no re-fetch
    // per selection). Deliberately derived from stock_items + stock_groups — NOT from
    // variant_inventory, which only holds the blended total (see currentStockSummary above).
    // `colorVariantId` both identifies the request (still the route's :colorVariantId) and picks
    // which variant is selected by default, per selectedColorVariantId below.
    async getCurrentStockDetail(colorVariantId) {
        const requestedVariant = await this._colorVariantRepository.findActiveById(db, colorVariantId);
        if (!requestedVariant) {
            throw new ApiError(`Color variant ${colorVariantId} not found or inactive.`, 404, "VARIANT_NOT_FOUND");
        }

        // Every active variant of the same design — including the requested one — so the page can
        // show a Blue/Green/Gold selector, not just the single variant that was requested.
        const designVariants = await this._colorVariantRepository.findByDesignIds([requestedVariant.designId]);

        const variants = await Promise.all(
            designVariants.map((variant) => this._buildVariantStockDetail(variant))
        );

        return {
            design: {
                id: requestedVariant.designId,
                code: requestedVariant.designCode,
                name: requestedVariant.designName,
            },
            selectedColorVariantId: colorVariantId,
            variants,
            total: this._buildTotalStockDetail(variants),
        };
    }

    // Single variant's stock breakdown — same computation whether it ends up shown on its own
    // (variant selected) or folded into _buildTotalStockDetail (Total selected).
    async _buildVariantStockDetail(variant) {
        const colorVariantId = variant.id;
        const sizes = await this._designSizeRepository.findActiveByVariantId(db, colorVariantId);

        const [loosePiecesBySize, setCount, bundleCountsByGroup] = await Promise.all([
            this._stockItemRepository.countLoosePiecesBySize(db, colorVariantId),
            this._stockItemRepository.countAvailableSets(db, colorVariantId),
            this._stockItemRepository.countBundlesByStockGroup(db, colorVariantId),
        ]);

        const loosePiecesByDesignSizeId = new Map(
            loosePiecesBySize.map((row) => [row.designSizeId, row.pieceCount])
        );

        // Resolve each bundle stock group's composition once, then explode bundleCount × pieceCount
        // per size — this is what avoids treating a "1 bundle" row as "1 piece per size" (§7).
        const bundleGroupIds = bundleCountsByGroup.map((row) => row.stockGroupId);
        const bundleGroups = await this._stockGroupRepository.findByIds(db, bundleGroupIds);
        const compositionByGroupId = new Map(
            bundleGroups.map((group) => [group.id, parseBundleCompositionSignature(group.compositionSignature)])
        );

        const bundlePiecesByDesignSizeId = new Map();
        for (const { stockGroupId, bundleCount } of bundleCountsByGroup) {
            const composition = compositionByGroupId.get(stockGroupId) ?? [];

            for (const piece of composition) {
                const existing = bundlePiecesByDesignSizeId.get(piece.designSizeId) ?? 0;
                bundlePiecesByDesignSizeId.set(piece.designSizeId, existing + piece.quantity * bundleCount);
            }
        }

        // Per-composition breakdown for the "Bundle Compositions" view — same bundleCount/
        // composition data already resolved above for the per-size explosion, just kept intact
        // here instead of only being folded into bundlePiecesByDesignSizeId.
        const sizeLabelById = new Map(sizes.map((size) => [size.id, size.sizeLabel]));
        const compositions = bundleCountsByGroup.map(({ stockGroupId, bundleCount }) => {
            const composition = compositionByGroupId.get(stockGroupId) ?? [];
            const piecesPerBundle = composition.reduce((sum, piece) => sum + piece.quantity, 0);

            return {
                stockGroupId,
                bundleCount,
                composition: composition.map((piece) => ({
                    designSizeId: piece.designSizeId,
                    // Falls back to the raw id if this composition references a size that's since
                    // been deactivated — sizes[] only lists currently active sizes (see §14 of the
                    // detail API design), so it can't always resolve a label.
                    size: sizeLabelById.get(piece.designSizeId) ?? String(piece.designSizeId),
                    quantity: piece.quantity,
                })),
                piecesPerBundle,
                totalPieces: piecesPerBundle * bundleCount,
            };
        }).sort((a, b) => a.stockGroupId - b.stockGroupId);

        const sizeRows = sizes.map((size) => {
            // A SET has no designSizeId of its own — it contributes 1 piece to every size that's
            // currently part of "a complete set" for this variant (same rule as
            // stockInCalculator._addCompleteSets / stockItem.service.assembleSet's setSizes).
            const setPieces = size.includedInSet ? setCount : 0;
            const bundlePieces = bundlePiecesByDesignSizeId.get(size.id) ?? 0;
            const loosePieces = loosePiecesByDesignSizeId.get(size.id) ?? 0;

            return {
                designSizeId: size.id,
                size: size.sizeLabel,
                setPieces,
                bundlePieces,
                loosePieces,
                totalPieces: setPieces + bundlePieces + loosePieces,
            };
        });

        const totals = sizeRows.reduce((acc, row) => ({
            setPieces: acc.setPieces + row.setPieces,
            bundlePieces: acc.bundlePieces + row.bundlePieces,
            loosePieces: acc.loosePieces + row.loosePieces,
            totalPieces: acc.totalPieces + row.totalPieces,
        }), { ...EMPTY_TOTALS });

        return {
            colorVariantId,
            colorName: variant.colorName,
            colorHex: variant.colorHex,
            imageUrl: variant.imageUrl,
            sizes: sizeRows,
            compositions,
            // Raw count of currently available SET stock items — same setCount already exploded
            // into every included-in-set size's setPieces above, exposed once here so a caller
            // (Stock Out's "sets to sell" input) doesn't have to re-derive it from sizeRows,
            // which would be ambiguous/zero when the variant has no set-included sizes at all.
            availableSets: setCount,
            totals,
        };
    }

    // Design-wide aggregate across every variant — "Total" on the selector.
    // Stock by Size is safely summed by sizeLabel: design_sizes rows are duplicated per variant
    // (see design.service.registerDesign, which applies one shared size list to every variant at
    // creation), but the label represents the same physical size across every color of a design.
    // Bundle compositions are NOT merged the same way: a stock_group is scoped to a single
    // colorVariantId and its composition's designSizeIds only mean something within that variant,
    // so a "Blue S:2,XL:1" bundle and a same-labeled "Green" bundle are physically different
    // assemblies — merging their counts would misrepresent which color the pieces belong to.
    // Total instead surfaces every variant's compositions together, each tagged with its variant.
    _buildTotalStockDetail(variants) {
        const totals = variants.reduce((acc, variant) => ({
            setPieces: acc.setPieces + variant.totals.setPieces,
            bundlePieces: acc.bundlePieces + variant.totals.bundlePieces,
            loosePieces: acc.loosePieces + variant.totals.loosePieces,
            totalPieces: acc.totalPieces + variant.totals.totalPieces,
        }), { ...EMPTY_TOTALS });

        const availableSets = variants.reduce((sum, variant) => sum + variant.availableSets, 0);

        const sizeRowByLabel = new Map();
        for (const variant of variants) {
            for (const row of variant.sizes) {
                const existing = sizeRowByLabel.get(row.size) ?? { size: row.size, ...EMPTY_TOTALS };

                sizeRowByLabel.set(row.size, {
                    size: row.size,
                    setPieces: existing.setPieces + row.setPieces,
                    bundlePieces: existing.bundlePieces + row.bundlePieces,
                    loosePieces: existing.loosePieces + row.loosePieces,
                    totalPieces: existing.totalPieces + row.totalPieces,
                });
            }
        }

        const compositions = variants.flatMap((variant) =>
            variant.compositions.map((composition) => ({
                ...composition,
                colorVariantId: variant.colorVariantId,
                colorName: variant.colorName,
                colorHex: variant.colorHex,
            }))
        ).sort((a, b) => a.colorVariantId - b.colorVariantId || a.stockGroupId - b.stockGroupId);

        return {
            // First-seen order across variants — every variant shares the same size ordering by
            // convention (same "one shared size list per design" invariant noted above).
            sizes: [...sizeRowByLabel.values()],
            compositions,
            availableSets,
            totals,
        };
    }
}

export default new CurrentStockService();
