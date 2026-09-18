const baseURL = import.meta.env.VITE_API_BASE_URL;

// Stock In dashboard + wizard drafts — same thin fetch contract as the other inventory
// services (JSON body, throw on non-ok using ApiResponse's error shape).
export async function stockInRequest(path, { method = "GET", body } = {}) {
    const response = await fetch(`${baseURL}/stock-in${path}`, {
        method,
        headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
        const error = new Error(data?.error?.message ?? data?.message ?? "Stock In request failed.");
        error.status = response.status;
        throw error;
    }

    return data;
}

export const getStockInDashboardApi = () => stockInRequest("/dashboard");

export const getStockInDraftsApi = () => stockInRequest("/drafts");

export const getStockInDraftApi = (draftId) => stockInRequest(`/drafts/${draftId}`);

// Creates the draft on first save, then updates the same row on every save after that.
export const saveStockInDraftApi = ({ draftId, currentStep, state }) =>
    draftId
        ? stockInRequest(`/drafts/${draftId}`, { method: "PUT", body: { currentStep, state } })
        : stockInRequest("/drafts", { method: "POST", body: { currentStep, state } });

export const deleteStockInDraftApi = (draftId) => stockInRequest(`/drafts/${draftId}`, { method: "DELETE" });
