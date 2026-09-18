// UI-only identity for a selected variant — never sent to the API, only used to key
// React lists and the per-variant config map. The real designId/colorVariantId stay
// untouched on the variant/config objects themselves.
export const getVariantKey = ({ designId, colorVariantId }) => `${designId}-${colorVariantId}`;
