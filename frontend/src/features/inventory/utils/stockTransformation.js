// Shared vocabulary for the Stock Transformation page. The API speaks in enums (custody types,
// suggestion kinds, broken-set states); these map them to what the user reads.

export const CUSTODY = {
  STOCK: { label: "In stock (loose)", short: "In stock", tone: "stock" },
  DISPLAY: { label: "On display", short: "Display", tone: "display" },
  SALESPERSON: { label: "With salesperson", short: "Salesperson", tone: "sales", holderLabel: "Salesperson" },
  SAMPLE: { label: "Sample with customer", short: "Customer sample", tone: "sample", holderLabel: "Customer" },
  ALTERATION: { label: "Out for alteration", short: "Alteration", tone: "alter", holderLabel: "Tailor / vendor" },
};

export const CUSTODY_ORDER = ["STOCK", "DISPLAY", "SALESPERSON", "SAMPLE", "ALTERATION"];

export const needsHolder = (type) => Boolean(CUSTODY[type]?.holderLabel);

export const BREAK_REASONS = [
  "Customer wanted single pieces",
  "Pieces for display",
  "Pieces for salesperson samples",
  "Sample for a customer",
  "A piece needs alteration",
  "Size exchange",
];

export const entryCode = (id) => `TRF-${String(id).padStart(4, "0")}`;

// A piece's short tag code, or a readable stand-in for an untagged loose piece.
export const pieceLabel = (piece) => (piece?.code ? piece.code : `Untagged #${piece?.stockItemId}`);

export const variantLabel = (item) => `${item.design.code} ${item.variant.colorName}`;

export const agoText = (days) => (days === null || days === undefined ? "" : days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`);

export function whereText(piece) {
  if (piece.state === "GONE") return "Sold / written off";
  if (piece.state === "INSIDE") return `In ${piece.insideCode ?? `#${piece.insideUnitId}`}`;
  const custody = CUSTODY[piece.custody.type];
  if (piece.custody.type === "STOCK") return "In stock";
  return `${custody.short}${piece.custody.holder ? ` · ${piece.custody.holder}` : ""} · ${agoText(piece.custody.days)}`;
}

// Stable identity for a "you can form a set now" suggestion — used to detect NEW possibilities
// after an action (the smart popup).
export const suggestionKey = (suggestion) =>
  `${suggestion.kind}:${suggestion.slots.map((slot) => slot.piece?.stockItemId ?? "-").sort().join(",")}`;

export const isFormable = (suggestion) => suggestion.kind === "RESTORE" || suggestion.kind === "FORM";

// Tags for one formed set: the new parent, then each tagged piece reprinted with its new parent ID.
export function buildTagList(labels, { includeChildren = true } = {}) {
  const tags = [{ kind: "parent", code: labels.parent.code, unitKind: labels.unitKind, sizes: labels.parent.sizes }];
  if (includeChildren) {
    for (const child of labels.children) tags.push({ kind: "child", code: child.code, size: child.size, parentCode: labels.parent.code });
  }
  return tags;
}
