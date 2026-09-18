// Shared helpers for the Current Stock page — formatting, filtering/grouping the overview's
// variant rows, and the CSV export. Every number here comes from the API as-is; nothing is
// re-derived except sums across rows.

export const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "in", label: "In stock" },
  { id: "low", label: "Low" },
  { id: "out", label: "Out of stock" },
  { id: "ageing", label: "Ageing 60+ days" },
];

export const SORTS = [
  { id: "code", label: "Design code A–Z" },
  { id: "most", label: "Most pieces" },
  { id: "least", label: "Fewest pieces" },
  { id: "value", label: "Highest value" },
  { id: "oldest", label: "Oldest stock first" },
];

export const ADD_REASONS = ["Opening stock", "Found during stock count", "Returned by customer", "Count correction"];
export const WRITE_OFF_REASONS = ["Damaged", "Lost / missing", "Given as sample", "Returned to jobber", "Count correction"];

const inrFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
export const formatInr = (value) => `₹${inrFormatter.format(Math.round(Number(value) || 0))}`;
export const formatNumber = (value) => inrFormatter.format(Number(value) || 0);

export const formatAge = (days) => (days === null || days === undefined ? "—" : days === 0 ? "Today" : `${days}d`);

// Non-negative whole number from a text input ("" stays "" so the field can be cleared).
export const toCount = (value) => {
  if (value === "") return "";
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 0 ? "" : parsed;
};

export const adjustmentCode = (id) => `ADJ-${String(id).padStart(4, "0")}`;

export const sumBy = (rows, pick) => rows.reduce((sum, row) => sum + (Number(pick(row)) || 0), 0);

export const variantLabel = (variant) => `${variant.design.code} ${variant.colorName}`;

export function filterVariants(variants, { query, status, designId, sort }) {
  const q = query.trim().toLowerCase();

  const rows = variants.filter((variant) => {
    if (designId && String(variant.design.id) !== String(designId)) return false;
    if (status === "in" && variant.totalPieces === 0) return false;
    if (status === "low" && variant.status !== "LOW") return false;
    if (status === "out" && variant.status !== "OUT_OF_STOCK") return false;
    if (status === "ageing" && !variant.isAgeing) return false;
    if (q) {
      const haystack = `${variant.design.code} ${variant.design.name} ${variant.colorName}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const byCode = (a, b) =>
    (a.design.code ?? "").localeCompare(b.design.code ?? "") || a.colorName.localeCompare(b.colorName);
  const comparators = {
    code: byCode,
    most: (a, b) => b.totalPieces - a.totalPieces || byCode(a, b),
    least: (a, b) => a.totalPieces - b.totalPieces || byCode(a, b),
    value: (a, b) => b.value - a.value || byCode(a, b),
    oldest: (a, b) => (b.oldestDays ?? -1) - (a.oldestDays ?? -1) || byCode(a, b),
  };
  return [...rows].sort(comparators[sort] ?? byCode);
}

// Groups already-sorted variant rows by design, keeping the order each design first appears in.
export function groupByDesign(variants) {
  const groups = new Map();
  for (const variant of variants) {
    if (!groups.has(variant.design.id)) groups.set(variant.design.id, { design: variant.design, variants: [] });
    groups.get(variant.design.id).variants.push(variant);
  }
  return [...groups.values()];
}

// Per-size totals across several variants of one design, summed by size label (every variant of a
// design shares the same size list).
export function aggregateSizes(variants) {
  const totals = new Map();
  for (const variant of variants) {
    for (const size of variant.sizes) totals.set(size.size, (totals.get(size.size) ?? 0) + size.quantity);
  }
  return [...totals.entries()].map(([size, quantity]) => ({ size, quantity }));
}

// Size-label columns for the matrix/CSV, in first-seen order across every variant.
export function allSizeLabels(variants) {
  const labels = [];
  for (const variant of variants) {
    for (const size of variant.sizes) if (!labels.includes(size.size)) labels.push(size.size);
  }
  return labels;
}

export const statusLabel = (variant) =>
  variant.status === "OUT_OF_STOCK" ? "Out of stock" : variant.status === "LOW" ? "Low" : "In stock";

// Lets Excel open the UTF-8 CSV with ₹ and non-ASCII names intact.
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCurrentStockCsv(variants, asOn) {
  const sizeLabels = allSizeLabels(variants);
  const header = [
    "Design", "Design name", "Variant", ...sizeLabels, "Complete sets", "Semi sets", "Loose pcs",
    "Total pcs", "Rate / pc", "Value", "Oldest (days)", "Low-stock level", "Status",
  ];
  const rows = variants.map((variant) => {
    const bySize = new Map(variant.sizes.map((size) => [size.size, size.quantity]));
    return [
      variant.design.code, variant.design.name, variant.colorName,
      ...sizeLabels.map((label) => (bySize.has(label) ? bySize.get(label) : "")),
      variant.sets, variant.semiSets, variant.loosePieces, variant.totalPieces,
      variant.design.sellingPricePerPiece, variant.value, variant.totalPieces ? variant.oldestDays : "",
      variant.lowStockLevel, statusLabel(variant),
    ];
  });

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([BYTE_ORDER_MARK + csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `current-stock-${asOn}.csv`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 400);
  return link.download;
}
