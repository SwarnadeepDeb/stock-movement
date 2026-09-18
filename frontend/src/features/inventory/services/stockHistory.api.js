const baseURL = import.meta.env.VITE_API_BASE_URL;

export const getStockHistoryApi = async ({ page = 1, limit = 20, keyword, eventType, colorVariantId, dateFrom, dateTo } = {}) => {
    const params = new URLSearchParams({ page, limit });
    if (keyword) params.set("keyword", keyword);
    if (eventType) params.set("eventType", eventType);
    if (colorVariantId) params.set("colorVariantId", colorVariantId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    const response = await fetch(`${baseURL}/stock-history?${params.toString()}`);

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message ?? "Failed to fetch stock history.");
    }

    return data;
};
