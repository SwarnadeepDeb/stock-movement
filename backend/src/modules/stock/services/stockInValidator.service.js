import colorVariantRepository from "../../design/repositories/colorVariant.repository.js";
import designSizeRepository from "../../design/repositories/designSize.repository.js";

import ApiError from "../../../core/apiError.js";

class StockInValidator {

    _colorVariantRepository = colorVariantRepository;
    _designSizeRepository = designSizeRepository;

    // can this stock in reques be accepted
    async validate(tx, designId, input) {
        const variant = await this._colorVariantRepository.findActiveById(tx, input.colorVariantId);

        if (!variant) {
            throw new ApiError(`Color variant ${input.colorVariantId} not found or inactive.`, 404, "VARIANT_NOT_FOUND");
        }

        if (variant.designId !== designId) {
            throw new ApiError(`Color variant ${input.colorVariantId} does not belong to design ${designId}.`, 400, "VARIANT_DESIGN_MISMATCH");
        }

        const activeSizes = await this._designSizeRepository.findActiveByVariantId(tx, variant.id);
        if (activeSizes.length === 0) {
            throw new ApiError(`Design ${designId} has no active sizes.`, 400, "NO_ACTIVE_SIZES");
        }

        this._validateReferencedSizes(input, activeSizes, variant.id);

        return { variant, activeSizes };
    }
    _validateReferencedSizes(input, activeSizes, variantId) {
        const validateSizeIds = new Set(activeSizes.map((size) => size.id))

        const referencedSizeIds = new Set();

        for (const bundle of input.bundles ?? []) {
            for (const piece of bundle.composition ?? []) {
                referencedSizeIds.add(piece.designSizeId);
            }
        }

        for (const piece of input.loosePieces ?? []) {
            referencedSizeIds.add(piece.designSizeId);
        }

        const invalidSizeIds = [...referencedSizeIds].filter((id) => !validateSizeIds.has(id));
        if (invalidSizeIds.length > 0) {
            throw new ApiError(`Invalid or inactive designSizeId(s) for color variant ${variantId}: ${invalidSizeIds.join(", ")}`, 400, "INVALID_DESIGN_SIZE");
        }
    }
}

export default new StockInValidator();
