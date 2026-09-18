const baseURL = import.meta.env.VITE_API_BASE_URL;

// Current Stock page (overview, variant drawer, adjustments) — same thin fetch contract as the
// other inventory services (JSON body, throw on non-ok using ApiResponse's error shape).
async function currentStockRequest(path, { method = "GET", body } = {}) {
    const response = await fetch(`${baseURL}/current-stock${path}`, {
        method,
        headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message ?? data?.message ?? "Current Stock request failed.");
    }

    return data;
}

export const getCurrentStockOverviewApi = () => currentStockRequest("/overview");

export const getCurrentStockVariantApi = (colorVariantId) => currentStockRequest(`/variants/${colorVariantId}`);

export const getStockAdjustmentsApi = () => currentStockRequest("/adjustments");

export const resolveStockTagApi = (code) => currentStockRequest(`/tags/${encodeURIComponent(code)}`);

export const addStockApi = (payload) => currentStockRequest("/adjustments/add", { method: "POST", body: payload });

export const writeOffStockApi = (payload) => currentStockRequest("/adjustments/write-off", { method: "POST", body: payload });

export const reverseStockAdjustmentApi = ({ id, note }) =>
    currentStockRequest(`/adjustments/${id}/reverse`, { method: "POST", body: { note } });

export const setLowStockLevelApi = ({ colorVariantId, lowStockLevel }) =>
    currentStockRequest(`/variants/${colorVariantId}/low-stock-level`, { method: "PATCH", body: { lowStockLevel } });
