const baseURL = import.meta.env.VITE_API_BASE_URL;

export const registerStockInApi = async (payload) => {
    const response = await fetch(`${baseURL}/stock-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message ?? "Failed to register stock in.");
    }

    return data;
};
