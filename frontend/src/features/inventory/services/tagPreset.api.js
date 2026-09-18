const baseURL = import.meta.env.VITE_API_BASE_URL;

export const saveTagPresetApi = async ({ designId, ...payload }) => {
    const response = await fetch(`${baseURL}/tag-presets/${designId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message ?? "Failed to save tag preset.");
    }

    return data;
};
