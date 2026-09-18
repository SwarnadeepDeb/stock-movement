const KIND_BRACKET = { parent: "PARENT SET", child: "GARMENT PIECE", loose: "LOOSE PIECE" };

const inr = (amount) => `₹ ${Number(amount || 0).toLocaleString("en-IN")}`;

// Text lines for one saved QR label on the confirmed A4 print, honouring the Tag content
// checkboxes chosen in QR Tag Studio (`content.fields[kind]`). The browser print sheet and the
// local print agent both draw these lines, so the toggles apply the same way to either.
// Without `content.fields` (an older client) it returns null and each renderer keeps its legacy layout.
export function buildConfirmedLabelLines(item, content = {}) {
  const fields = content.fields;
  if (!fields) return null;

  const payload = item.payload ?? {};
  const isParent = item.type === "SET" || item.type === "BUNDLE";
  const kind = isParent ? "parent" : item.parentStockItemId ? "child" : "loose";
  const f = fields[kind] ?? {};
  const piecesPerSet = Number(item.piecesPerSet ?? item.composition?.length ?? 0);
  const price = Number(item.priceSnapshot ?? item.sellingPricePerPiece ?? 0);
  const designCode = item.design?.code ?? payload.designCode ?? "STOCK";
  const variantName = (item.variant?.colorName ?? payload.colorName ?? "").toUpperCase();
  const stockId = item.displayCode ?? payload.setId ?? item.stockItemId;

  const lines = [];
  if (f.firm) lines.push({ text: `${content.firm ?? ""} [${KIND_BRACKET[kind]}]`, style: "muted" });
  lines.push({ text: String(stockId), style: "title" });
  lines.push({ text: `${f.design === false ? "" : `${designCode} · `}${variantName}`, style: "muted" });
  if (f.dname && (item.design?.name ?? payload.designName)) lines.push({ text: item.design?.name ?? payload.designName, style: "muted" });

  if (isParent) {
    const label = item.type === "BUNDLE" ? "SEMI" : "SET";
    const composition = (item.composition ?? []).join(" · ");
    if (f.comp) lines.push({ text: `${label}: ${composition} (${piecesPerSet} Pcs)`, style: "bold" });
    else lines.push({ text: `${label} ${piecesPerSet}-PC`, style: "bold" });
  } else {
    if (f.size) lines.push({ text: `SIZE ${item.designSizeLabel ?? ""}`, style: "bold" });
    const parentId = payload.parentSetId ?? payload.parentId;
    if (kind === "child" && f.parent && parentId) lines.push({ text: `PARENT: ${parentId}`, style: "muted" });
  }

  if (f.jobber) lines.push({ text: content.jobber ?? "UNASSIGNED", style: "muted" });
  if (f.price) lines.push({ text: `MRP ${inr(price)} / PC`, style: "price" });
  if (kind === "loose" && f.origin) lines.push({ text: "LOOSE — FROM JOBBER", style: "bold" });
  if (f.date && content.date) lines.push({ text: `${kind === "loose" ? "LOOSE SINCE" : "INWARD"} ${content.date}`, style: "muted" });

  return lines;
}
