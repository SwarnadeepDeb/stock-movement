import qrCenterService from "../services/qrCenter.service.js";
import qrBatchService from "../services/qrBatch.service.js";
import { ApiResponse } from "../../../core/apiResponse.js";

class QrCenterController {
    _qrCenterService = qrCenterService;
    _qrBatchService = qrBatchService;

    list = async (req, res, next) => {
        try {
            const response = await this._qrCenterService.listRegistrations(req.validatedQuery);

            return res.status(200).json(new ApiResponse(200, response.data, "Stock registrations fetched successfully.", response.meta));
        } catch (error) {
            next(error);
        }
    };

    listBatches = async (req, res, next) => {
        try {
            const response = await this._qrBatchService.listBatches(req.validatedQuery);
            return res.status(200).json(new ApiResponse(200, response.data, "Stock-in batches fetched.", response.meta));
        } catch (error) {
            next(error);
        }
    };

    getBatch = async (req, res, next) => {
        try {
            const response = await this._qrBatchService.getBatch(req.params.batchId);
            return res.status(200).json(new ApiResponse(200, response, "Stock-in batch fetched."));
        } catch (error) {
            next(error);
        }
    };

    issueBatch = async (req, res, next) => {
        try {
            const response = await this._qrBatchService.issueBatch(req.params.batchId, req.body);
            return res.status(200).json(new ApiResponse(200, response, "Batch tags ready to print."));
        } catch (error) {
            next(error);
        }
    };

    confirmBatchPrint = async (req, res, next) => {
        try {
            const response = await this._qrBatchService.confirmPrint(req.params.batchId, req.body);
            return res.status(200).json(new ApiResponse(200, response, "Batch print recorded."));
        } catch (error) {
            next(error);
        }
    };

    getDetail = async (req, res, next) => {
        const { stockInTransactionId } = req.params;

        try {
            const response = await this._qrCenterService.getRegistrationDetail({
                registrationType: "STOCK_IN",
                registrationId: stockInTransactionId,
            });

            return res.status(200).json(new ApiResponse(200, response, "Stock registration QRs fetched successfully."));
        } catch (error) {
            next(error);
        }
    };

    getTransformationDetail = async (req, res, next) => {
        const { transformationId } = req.params;

        try {
            const response = await this._qrCenterService.getRegistrationDetail({
                registrationType: "TRANSFORMATION",
                registrationId: transformationId,
            });

            return res.status(200).json(new ApiResponse(200, response, "Stock transformation QRs fetched successfully."));
        } catch (error) {
            next(error);
        }
    };

    searchTags = async (req, res, next) => {
        try {
            const response = await this._qrCenterService.searchTags(req.validatedQuery);
            return res.status(200).json(new ApiResponse(200, response.data, "Tags fetched.", response.meta));
        } catch (error) {
            next(error);
        }
    };

    getBatchQueue = async (req, res, next) => {
        const { stockInTransactionId } = req.params;

        try {
            const response = await this._qrCenterService.getBatchQueue(stockInTransactionId);
            return res.status(200).json(new ApiResponse(200, response, "Batch tag queue fetched."));
        } catch (error) {
            next(error);
        }
    };

    printBatchQueue = async (req, res, next) => {
        const { stockInTransactionId } = req.params;

        try {
            const response = await this._qrCenterService.printBatchQueue(stockInTransactionId, req.body);
            return res.status(200).json(new ApiResponse(200, response, "Batch tags printed."));
        } catch (error) {
            next(error);
        }
    };

    generate = async (req, res, next) => {
        const { stockItemIds } = req.body;

        try {
            const response = await this._qrCenterService.generateForStockItemIds(stockItemIds);

            return res.status(200).json(new ApiResponse(200, response, "QR codes generated."));
        } catch (error) {
            next(error);
        }
    };

    resolve = async (req, res, next) => {
        try {
            const response = await this._qrCenterService.resolve(req.validatedQuery.code);
            return res.status(200).json(new ApiResponse(200, response, "Code resolved."));
        } catch (error) {
            next(error);
        }
    };

    health = async (req, res, next) => {
        try {
            const response = await this._qrCenterService.getHealth();
            return res.status(200).json(new ApiResponse(200, response, "QR Center health fetched."));
        } catch (error) {
            next(error);
        }
    };

    listToTag = async (req, res, next) => {
        try {
            const response = await this._qrCenterService.listToTag(req.validatedQuery);
            return res.status(200).json(new ApiResponse(200, response.data, "To-tag queue fetched.", response.meta));
        } catch (error) {
            next(error);
        }
    };

    listReprints = async (req, res, next) => {
        try {
            const response = await this._qrCenterService.listReprints(req.validatedQuery);
            return res.status(200).json(new ApiResponse(200, response.data, "Reprint requests fetched.", response.meta));
        } catch (error) {
            next(error);
        }
    };

    createReprint = async (req, res, next) => {
        try {
            const response = await this._qrCenterService.createReprintRequest(req.body);
            return res.status(201).json(new ApiResponse(201, response, "Reprint request raised."));
        } catch (error) {
            next(error);
        }
    };

    bulkPrintReprints = async (req, res, next) => {
        try {
            const response = await this._qrCenterService.bulkPrintReprints(req.body);
            return res.status(200).json(new ApiResponse(200, response, "Reprint batch printed."));
        } catch (error) {
            next(error);
        }
    };

    listStale = async (req, res, next) => {
        try {
            const response = await this._qrCenterService.listStale();
            return res.status(200).json(new ApiResponse(200, response.data, "Stale tags fetched."));
        } catch (error) {
            next(error);
        }
    };

    staleReprint = async (req, res, next) => {
        try {
            const response = await this._qrCenterService.staleReprint(req.body);
            return res.status(200).json(new ApiResponse(200, response, "Stale tags reprinted."));
        } catch (error) {
            next(error);
        }
    };

    staleAccept = async (req, res, next) => {
        try {
            const response = await this._qrCenterService.staleAccept(req.body);
            return res.status(200).json(new ApiResponse(200, response, "Stale prices accepted."));
        } catch (error) {
            next(error);
        }
    };

    listRecovery = async (req, res, next) => {
        try {
            const response = await this._qrCenterService.listRecovery(req.validatedQuery);
            return res.status(200).json(new ApiResponse(200, response.data, "Recovery queue fetched."));
        } catch (error) {
            next(error);
        }
    };

    createRecovery = async (req, res, next) => {
        try {
            const response = await this._qrCenterService.createRecovery(req.body);
            return res.status(201).json(new ApiResponse(201, response, "Recovery entry logged."));
        } catch (error) {
            next(error);
        }
    };

    assignRecoveryIdentity = async (req, res, next) => {
        const { id } = req.params;

        try {
            const response = await this._qrCenterService.assignRecoveryIdentity(id, req.body);
            return res.status(200).json(new ApiResponse(200, response, "Recovery identity assigned."));
        } catch (error) {
            next(error);
        }
    };

    listJobs = async (req, res, next) => {
        try {
            const response = await this._qrCenterService.listJobs(req.validatedQuery);
            return res.status(200).json(new ApiResponse(200, response.data, "Print jobs fetched.", response.meta));
        } catch (error) {
            next(error);
        }
    };

    reprintJobRange = async (req, res, next) => {
        const { id } = req.params;

        try {
            const response = await this._qrCenterService.reprintJobRange(id, req.body);
            return res.status(200).json(new ApiResponse(200, response, "Print job range reprinted."));
        } catch (error) {
            next(error);
        }
    };

    verifyJobSample = async (req, res, next) => {
        const { id } = req.params;

        try {
            const response = await this._qrCenterService.verifyJobSample(id);
            return res.status(200).json(new ApiResponse(200, response, "Print job sample verified."));
        } catch (error) {
            next(error);
        }
    };

    breakSet = async (req, res, next) => {
        try {
            const response = await this._qrCenterService.breakSet(req.body);
            return res.status(200).json(new ApiResponse(200, response, "Set broken into pieces."));
        } catch (error) {
            next(error);
        }
    };

    runBulkGenerator = async (req, res, next) => {
        const { kind } = req.params;

        try {
            const response = await this._qrCenterService.runBulkGenerator(kind, req.body);
            return res.status(200).json(new ApiResponse(200, response, "Bulk print job created."));
        } catch (error) {
            next(error);
        }
    };

    printCheck = async (req, res, next) => {
        try {
            const response = await this._qrCenterService.printCheck(req.body);
            return res.status(200).json(new ApiResponse(200, response, "Print check completed."));
        } catch (error) {
            next(error);
        }
    };

    reference = async (req, res, next) => {
        try {
            const response = await this._qrCenterService.getReference();
            return res.status(200).json(new ApiResponse(200, response, "QR Center reference data fetched."));
        } catch (error) {
            next(error);
        }
    };
}

export default new QrCenterController();
