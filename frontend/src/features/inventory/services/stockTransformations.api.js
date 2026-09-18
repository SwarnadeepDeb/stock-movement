const baseURL = import.meta.env.VITE_API_BASE_URL;

// Stock Transformation page — break / form / move pieces, the log, and tag lookups. Same thin
// fetch contract as the other inventory services (JSON body, throw with the API's message).
async function transformationRequest(path, { method = "GET", body } = {}) {
    const response = await fetch(`${baseURL}/stock-transformations${path}`, {
        method,
        headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message ?? data?.message ?? "Stock transformation request failed.");
    }

    return data;
}

const code = (value) => encodeURIComponent(String(value).trim());

export const getTransformationOverviewApi = () => transformationRequest("/overview");
export const getTransformationLogApi = () => transformationRequest("/log");
export const getTagJourneyApi = (tagCode) => transformationRequest(`/journey/${code(tagCode)}`);
export const getVariantPoolApi = (colorVariantId) => transformationRequest(`/variants/${colorVariantId}/pool`);
export const resolveUnitApi = (tagCode) => transformationRequest(`/units/${code(tagCode)}`);
export const resolvePieceApi = (tagCode) => transformationRequest(`/pieces/${code(tagCode)}`);

export const breakUnitApi = (payload) => transformationRequest("/break", { method: "POST", body: payload });
export const formUnitApi = (payload) => transformationRequest("/form", { method: "POST", body: payload });
export const movePiecesApi = (payload) => transformationRequest("/move", { method: "POST", body: payload });
export const undoTransformationApi = ({ id, note }) => transformationRequest(`/${id}/undo`, { method: "POST", body: { note } });
