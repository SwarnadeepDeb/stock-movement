import { query, request } from "./http.js";

export const getOrderFormsApi = ({ page = 1, limit = 50, q = "", status } = {}) =>
    request(`/order-forms?${query({ page, limit, q, status })}`);

export const getOrderFormApi = (id) => request(`/order-forms/${id}`);

export const getOrderFormByNumberApi = (number) => request(`/order-forms/by-number/${encodeURIComponent(number)}`);

export const checkOrderFormNumberApi = ({ number, excludeId }) =>
    request(`/order-forms/check-number?${query({ number, excludeId })}`);

export const suggestOrderFormNumberApi = () => request("/order-forms/next-number");

export const createOrderFormApi = (payload) => request("/order-forms", { method: "POST", body: JSON.stringify(payload) });

export const updateOrderFormApi = (id, payload) => request(`/order-forms/${id}`, { method: "PUT", body: JSON.stringify(payload) });

export const cancelOrderFormApi = (id) => request(`/order-forms/${id}/cancel`, { method: "PATCH" });
