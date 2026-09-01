import { ApiResponse } from "../../../core/apiResponse.js";
import orderFormService from "../services/orderForm.service.js";

class OrderFormController {
    _orderFormService = orderFormService;

    createOrderForm = async (req, res, next) => {
        try {
            const result = await this._orderFormService.createOrderForm(req.body);
            return res.status(201).json(new ApiResponse(201, result, `Order form ${result.formNumber} saved.`));
        } catch (error) {
            next(error);
        }
    };

    updateOrderForm = async (req, res, next) => {
        try {
            const result = await this._orderFormService.updateOrderForm(req.params.id, req.body);
            return res.status(200).json(new ApiResponse(200, result, `Order form ${result.formNumber} updated.`));
        } catch (error) {
            next(error);
        }
    };

    cancelOrderForm = async (req, res, next) => {
        try {
            const result = await this._orderFormService.cancelOrderForm(req.params.id);
            return res.status(200).json(new ApiResponse(200, result, `Order form ${result.formNumber} cancelled.`));
        } catch (error) {
            next(error);
        }
    };

    getOrderForm = async (req, res, next) => {
        try {
            const result = await this._orderFormService.getOrderForm(req.params.id);
            return res.status(200).json(new ApiResponse(200, result, "Order form fetched successfully."));
        } catch (error) {
            next(error);
        }
    };

    getOrderFormByNumber = async (req, res, next) => {
        try {
            const result = await this._orderFormService.getOrderFormByNumber(req.params.number);
            return res.status(200).json(new ApiResponse(200, result, "Order form fetched successfully."));
        } catch (error) {
            next(error);
        }
    };

    listOrderForms = async (req, res, next) => {
        try {
            const response = await this._orderFormService.listOrderForms(req.validatedQuery);
            return res.status(200).json(new ApiResponse(200, response.data, "Order forms fetched successfully.", response.meta));
        } catch (error) {
            next(error);
        }
    };

    checkNumber = async (req, res, next) => {
        try {
            const { number, excludeId } = req.validatedQuery;
            const result = await this._orderFormService.checkNumber(number, excludeId);
            return res.status(200).json(new ApiResponse(200, result, "Checked."));
        } catch (error) {
            next(error);
        }
    };

    suggestNumber = async (req, res, next) => {
        try {
            const result = await this._orderFormService.suggestNumber();
            return res.status(200).json(new ApiResponse(200, result, "Suggested."));
        } catch (error) {
            next(error);
        }
    };
}

export default new OrderFormController();
