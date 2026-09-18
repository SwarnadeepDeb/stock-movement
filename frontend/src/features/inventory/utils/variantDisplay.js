// Synthetic per-variant display code (e.g. "KP100-RED") for the Stock In wizard — color
// variants don't carry their own short code in the data model, only colorName/colorHex, so
// this derives a readable, stable label from the design code + colour name instead.
export const getVariantDisplayCode = (variant) =>
  `${variant?.designCode ?? "DSN"}-${(variant?.colorName ?? "").replace(/\s+/g, "").slice(0, 3).toUpperCase()}`;
