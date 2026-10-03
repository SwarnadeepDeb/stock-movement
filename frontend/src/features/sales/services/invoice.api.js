import { query, request } from "./http.js";

export const getInvoicesApi = ({ page = 1, limit = 50, q = "" } = {}) =>
    request(`/invoices?${query({ page, limit, q })}`);

export const getInvoiceApi = (id) => request(`/invoices/${id}`);

export const getInvoiceByNumberApi = (number) => request(`/invoices/by-number/${encodeURIComponent(number)}`);

export const checkInvoiceNumberApi = ({ number, excludeId }) =>
    request(`/invoices/check-number?${query({ number, excludeId })}`);

export const suggestInvoiceNumberApi = () => request("/invoices/next-number");

// Resolves one code as it is scanned. Separate from saving so the picker gets an answer per
// scan instead of a wall of errors at the end.
export const checkScanApi = ({ code, scanned = [], invoiceId }) =>
    request(`/invoices/scan?${query({ code, scanned: scanned.join(","), invoiceId })}`);

export const generateInvoiceApi = (payload) => request("/invoices", { method: "POST", body: JSON.stringify(payload) });

export const updateInvoiceApi = (id, payload) => request(`/invoices/${id}`, { method: "PUT", body: JSON.stringify(payload) });
