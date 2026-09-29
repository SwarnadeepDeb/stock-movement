const baseURL = import.meta.env.VITE_API_BASE_URL;

export const registerDesignApi = async ({ colorVariants, designSizes, semiSets = [], images, ...designData }) => {
    const formData = new FormData();

    Object.entries(designData).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            formData.append(key, value);
        }
    });

    formData.append("colorVariants", JSON.stringify(colorVariants));
    formData.append("designSizes", JSON.stringify(designSizes));
    formData.append("semiSets", JSON.stringify(semiSets));

    images.forEach((image) => formData.append("images", image));

    const response = await fetch(`${baseURL}/designs`, {
        method: "POST",
        body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message ?? "Failed to register design.");
    }

    return data;
};

export const getAllDesignsApi = async ({ page = 1, limit = 20, keyword, sort } = {}) => {
    const params = new URLSearchParams({ page, limit });
    if (keyword?.trim()) params.set("keyword", keyword.trim());
    if (sort) params.set("sort", sort);

    const response = await fetch(`${baseURL}/designs?${params.toString()}`);

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message ?? "Failed to fetch designs.");
    }

    return data;
};

export const searchDesignsApi = async (keyword) => {
    const params = new URLSearchParams({ keyword });

    const response = await fetch(`${baseURL}/designs/search?${params.toString()}`);

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message ?? "Failed to search designs.");
    }

    return data;
};

export const searchJobbersApi = async (keyword) => {
    const params = new URLSearchParams({ keyword });

    const response = await fetch(`${baseURL}/designs/jobbers?${params.toString()}`);

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message ?? "Failed to search jobbers.");
    }

    return data;
};

export const searchQualitiesApi = async (keyword) => {
    const params = new URLSearchParams({ keyword });

    const response = await fetch(`${baseURL}/designs/qualities?${params.toString()}`);

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message ?? "Failed to search qualities.");
    }

    return data;
};

export const getItemNamesApi = async () => {
    const response = await fetch(`${baseURL}/designs/item-names`);

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message ?? "Failed to fetch item names.");
    }

    return data;
};

export const searchPatternsApi = async (keyword) => {
    const params = new URLSearchParams({ keyword });

    const response = await fetch(`${baseURL}/designs/patterns?${params.toString()}`);

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message ?? "Failed to search patterns.");
    }

    return data;
};

export const getActiveColorVariantSizesApi = async (colorVariantId) => {
    const response = await fetch(`${baseURL}/designs/color-variants/${colorVariantId}/sizes`);

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message ?? "Failed to fetch active sizes.");
    }

    return data;
};

export const getVariantSemiSetsApi = async (colorVariantId) => {
    const response = await fetch(`${baseURL}/designs/color-variants/${colorVariantId}/semi-sets`);

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message ?? "Failed to fetch semi sets.");
    }

    return data;
};

export const getDesignApi = async (id) => {
    const response = await fetch(`${baseURL}/designs/${id}`);

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message ?? "Failed to fetch design.");
    }

    return data;
};

// Same multipart contract as register: colorVariants lists every variant the design should have
// after the edit (with `id` = existing, without = new; replaceImage flags a new photo), and
// `images` holds one file per new-or-replaced variant, in that same order.
export const updateDesignApi = async ({ id, colorVariants, designSizes, semiSets = [], images, ...designData }) => {
    const formData = new FormData();

    Object.entries(designData).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            formData.append(key, value);
        }
    });

    formData.append("colorVariants", JSON.stringify(colorVariants));
    formData.append("designSizes", JSON.stringify(designSizes));
    formData.append("semiSets", JSON.stringify(semiSets));

    images.forEach((image) => formData.append("images", image));

    const response = await fetch(`${baseURL}/designs/${id}`, {
        method: "PUT",
        body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message ?? "Failed to update design.");
    }

    return data;
};
