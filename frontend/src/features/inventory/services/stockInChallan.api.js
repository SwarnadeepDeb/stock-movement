import { stockInRequest } from "./stockInDraft.api.js";

// Stock In challan register — list/detail/edit/drop/audit against /stock-in/challans.
const toQueryString = (params) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") search.set(key, value);
    });
    const text = search.toString();
    return text ? `?${text}` : "";
};

export const getStockInChallansApi = (params) => stockInRequest(`/challans${toQueryString(params)}`);

export const getStockInChallanApi = (id) => stockInRequest(`/challans/${id}`);

export const getStockInJobberSummaryApi = () => stockInRequest("/challans/jobbers");

export const getNextStockInSerialApi = () => stockInRequest("/challans/next-serial");

export const updateStockInChallanApi = ({ id, ...body }) => stockInRequest(`/challans/${id}`, { method: "PATCH", body });

export const dropStockInChallanApi = ({ id, reason }) => stockInRequest(`/challans/${id}/drop`, { method: "POST", body: { reason } });

export const logStockInChallanEventApi = ({ id, kind }) => stockInRequest(`/challans/${id}/events`, { method: "POST", body: { kind } });

// Last QR serial issued per colour variant, so a new inward numbers its labels after them.
export const getSerialCountersApi = (colorVariantIds) =>
    stockInRequest(`/serial-counters?colorVariantIds=${colorVariantIds.join(",")}`);
