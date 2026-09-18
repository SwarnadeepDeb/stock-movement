const baseURL = import.meta.env.VITE_API_BASE_URL;

export const getCurrentStockApi = async ({ page = 1, limit = 20, keyword } = {}) => {
    const params = new URLSearchParams({ page, limit });
    if (keyword) params.set("keyword", keyword);

    const response = await fetch(`${baseURL}/current-stock?${params.toString()}`);

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message ?? "Failed to fetch current stock.");
    }

    return data;
};

export const getCurrentStockDetailApi = async (colorVariantId) => {
    const response = await fetch(`${baseURL}/current-stock/${colorVariantId}`);

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message ?? "Failed to fetch stock details.");
    }

    return data;
};
