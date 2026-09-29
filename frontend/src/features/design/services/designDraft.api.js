const baseURL = import.meta.env.VITE_API_BASE_URL;

// Register Design wizard drafts — same thin fetch contract as the Stock In drafts service
// (JSON body, throw on non-ok using ApiResponse's error shape).
async function designDraftRequest(path, { method = "GET", body } = {}) {
    const response = await fetch(`${baseURL}/designs/drafts${path}`, {
        method,
        headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
        const error = new Error(data?.error?.message ?? data?.message ?? "Design draft request failed.");
        error.status = response.status;
        throw error;
    }

    return data;
}

export const createDesignDraftApi = ({ currentStep, state }) =>
    designDraftRequest("", { method: "POST", body: { currentStep, state } });
