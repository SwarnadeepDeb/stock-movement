const baseURL = import.meta.env.VITE_API_BASE_URL;

export const getLooseAvailabilityApi = async (colorVariantId) => {
    const response = await fetch(`${baseURL}/stock-items/loose-availability/${colorVariantId}`);

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message ?? "Failed to fetch loose piece availability.");
    }

    return data;
};

export const assembleSetApi = async ({ colorVariantId, quantity }) => {
    const response = await fetch(`${baseURL}/stock-items/assemble-set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colorVariantId, quantity }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message ?? "Failed to transform loose pieces into sets.");
    }

    return data;
};

// stockGroupId identifies one of the variant's existing bundle configurations — the backend
// resolves the authoritative composition from it; the frontend never sends a composition.
export const assembleBundleApi = async ({ colorVariantId, stockGroupId, quantity }) => {
    const response = await fetch(`${baseURL}/stock-items/assemble-bundle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colorVariantId, stockGroupId, quantity }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message ?? "Failed to transform loose pieces into bundles.");
    }

    return data;
};
