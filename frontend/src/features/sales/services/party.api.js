import { query, request } from "./http.js";

export const getPartiesApi = ({ page = 1, limit = 50, q = "", includeInactive = false } = {}) =>
    request(`/parties?${query({ page, limit, q, includeInactive })}`);

export const getPartyApi = (id) => request(`/parties/${id}`);

export const createPartyApi = (payload) => request("/parties", { method: "POST", body: JSON.stringify(payload) });

export const updatePartyApi = (id, payload) => request(`/parties/${id}`, { method: "PUT", body: JSON.stringify(payload) });

export const updatePartyStatusApi = (id, isActive) =>
    request(`/parties/${id}/status`, { method: "PATCH", body: JSON.stringify({ isActive }) });
