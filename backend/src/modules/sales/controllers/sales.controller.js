import { ApiResponse } from "../../../core/apiResponse.js";
import galleryService from "../services/gallery.service.js";
import designFinderService from "../services/designFinder.service.js";
import overviewService from "../services/overview.service.js";
import scanResolverService from "../services/scanResolver.service.js";

class SalesController {
    _galleryService = galleryService;
    _overviewService = overviewService;
    _designFinderService = designFinderService;

    getOverview = async (req, res, next) => {
        try {
            const result = await this._overviewService.getSummary();
            return res.status(200).json(new ApiResponse(200, result, "Overview fetched successfully."));
        } catch (error) {
            next(error);
        }
    };

    // Resolves a scanned tag, then returns every variant of the design it belongs to — one
    // round trip for the whole "scan a hanging tag, type quantities per colour" interaction.
    resolveForOrderForm = async (req, res, next) => {
        try {
            const resolved = await scanResolverService.resolve(req.validatedQuery.code);

            if (!resolved || resolved.state !== "OK") {
                return res.status(200).json(new ApiResponse(200, resolved ?? { state: "UNKNOWN", shortCode: req.validatedQuery.code }, "Scan resolved."));
            }

            // `focusColorVariantId` is the tag's own colour: the screen opens on that colour's row.
            const design = await this._designFinderService.byId(resolved.designId, { focusColorVariantId: resolved.colorVariantId });

            return res.status(200).json(new ApiResponse(200, { ...resolved, design }, "Scan resolved."));
        } catch (error) {
            next(error);
        }
    };

    // The order form's "Add designs" box: designs (with their colours, stock and set size) that
    // match whatever was typed.
    searchDesigns = async (req, res, next) => {
        try {
            const result = await this._designFinderService.search(req.validatedQuery.q);
            return res.status(200).json(new ApiResponse(200, result, "Designs fetched successfully."));
        } catch (error) {
            next(error);
        }
    };

    getDesignVariants = async (req, res, next) => {
        try {
            const result = await this._designFinderService.byId(req.params.designId);
            return res.status(200).json(new ApiResponse(200, result, "Design fetched successfully."));
        } catch (error) {
            next(error);
        }
    };

    getGallery = async (req, res, next) => {
        try {
            const { mode, number, q, designId, stock } = req.validatedQuery;

            const result = mode === "orderForm" ? await this._galleryService.byOrderForm(number)
                : mode === "invoice" ? await this._galleryService.byInvoice(number)
                : await this._galleryService.all({ q, designId, stock });

            return res.status(200).json(new ApiResponse(200, result, "Gallery fetched successfully."));
        } catch (error) {
            next(error);
        }
    };
}

export default new SalesController();
