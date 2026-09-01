import { ApiResponse } from "../../../core/apiResponse.js";
import invoiceService from "../services/invoice.service.js";

class InvoiceController {
    _invoiceService = invoiceService;

    generateInvoice = async (req, res, next) => {
        try {
            const result = await this._invoiceService.generateInvoice(req.body);
            return res.status(201).json(new ApiResponse(
                201,
                result,
                `Invoice ${result.invoiceNumber} generated — ${result.totalPcs} pcs deducted from stock.`,
            ));
        } catch (error) {
            next(error);
        }
    };

    updateInvoice = async (req, res, next) => {
        try {
            const result = await this._invoiceService.updateInvoice(req.params.id, req.body);
            return res.status(200).json(new ApiResponse(200, result, `Invoice ${result.invoiceNumber} updated and stock adjusted.`));
        } catch (error) {
            next(error);
        }
    };

    getInvoice = async (req, res, next) => {
        try {
            const result = await this._invoiceService.getInvoice(req.params.id);
            return res.status(200).json(new ApiResponse(200, result, "Invoice fetched successfully."));
        } catch (error) {
            next(error);
        }
    };

    getInvoiceByNumber = async (req, res, next) => {
        try {
            const result = await this._invoiceService.getInvoiceByNumber(req.params.number);
            return res.status(200).json(new ApiResponse(200, result, "Invoice fetched successfully."));
        } catch (error) {
            next(error);
        }
    };

    listInvoices = async (req, res, next) => {
        try {
            const response = await this._invoiceService.listInvoices(req.validatedQuery);
            return res.status(200).json(new ApiResponse(200, response.data, "Invoices fetched successfully.", response.meta));
        } catch (error) {
            next(error);
        }
    };

    checkScan = async (req, res, next) => {
        try {
            const { code, scanned, invoiceId } = req.validatedQuery;
            const result = await this._invoiceService.checkScan(code, { excludeCodes: scanned, invoiceId });
            return res.status(200).json(new ApiResponse(200, result, "Scan resolved."));
        } catch (error) {
            next(error);
        }
    };

    checkNumber = async (req, res, next) => {
        try {
            const { number, excludeId } = req.validatedQuery;
            const result = await this._invoiceService.checkNumber(number, excludeId);
            return res.status(200).json(new ApiResponse(200, result, "Checked."));
        } catch (error) {
            next(error);
        }
    };

    suggestNumber = async (req, res, next) => {
        try {
            const result = await this._invoiceService.suggestNumber();
            return res.status(200).json(new ApiResponse(200, result, "Suggested."));
        } catch (error) {
            next(error);
        }
    };
}

export default new InvoiceController();
