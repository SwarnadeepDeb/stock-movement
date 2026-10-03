import { query, request } from "./http.js";

export const getOverviewApi = () => request("/sales/overview");

export const getGalleryApi = ({ mode = "all", number, q, designId, stock = "all" } = {}) =>
    request(`/sales/gallery?${query({ mode, number, q, designId, stock })}`);

// One round trip for "what did I just scan, and what colours does that design come in?" — the
// whole interaction behind adding a design to an order form.
export const resolveDesignApi = (code) => request(`/sales/resolve-design?${query({ code })}`);

export const getDesignVariantsApi = (designId) => request(`/sales/designs/${designId}/variants`);

// Designs matching whatever was typed in the order form's "Add designs" box — a design code, an
// item / pattern / quality / colour word, or a hanging tag's ID — each with its colours, live
// stock and set size. An empty query returns the designs to offer before anything is typed.
export const searchDesignsApi = (q) => request(`/sales/design-search?${query({ q })}`);
