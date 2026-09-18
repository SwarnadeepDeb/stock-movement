import { flagsForTag } from "./qrTagStudio";

// Pure helpers behind QR Center's "Configure & print" studio. A batch comes from
// GET /qr-center/batches/:id as variants[].tags[] (see qrBatch.service.js); everything the studio
// shows — queue counts, the live preview, what gets printed — is derived from those tags here, so
// the numbers on screen are the numbers that print.

// Same firm header the Stock In wizard prints (QrTagStudioStep).
export const FIRM_LABEL = "SHAKSHAM'S FASHIONS";

export const formatDdMmYy = (isoDate) => {
  if (!isoDate) return "—";
  const [year, month, day] = String(isoDate).slice(0, 10).split("-");
  return `${day}-${month}-${year.slice(2)}`;
};

// Every tag the chosen strategy covers, per colour still switched on, as { variant, tag } so a
// preview or print can resolve the design and colour. Tags already printed stay out unless the
// user also wants reprints.
export function queuedEntries(variants, { tagParentChild, tagLoose, included, reprint }) {
  return variants.flatMap((variant) => {
    if (included[variant.transactionId] === false) return [];
    return variant.tags
      .filter((tag) => (tag.kind === "loose" ? tagLoose : tagParentChild) && (reprint || !tag.printed))
      .map((tag) => ({ variant, tag }));
  });
}

// Counts for the queue table row of one colour, under the current strategy.
export function variantQueueCounts(variant, { tagParentChild, tagLoose, included, reprint }) {
  const queued = queuedEntries([variant], { tagParentChild, tagLoose, included: {}, reprint }).map((entry) => entry.tag);
  const issued = variant.tags.filter((tag) => tag.code);
  return {
    included: included[variant.transactionId] !== false,
    parent: queued.filter((tag) => tag.kind === "parent").length,
    child: queued.filter((tag) => tag.kind === "child").length,
    loose: queued.filter((tag) => tag.kind === "loose").length,
    total: queued.length,
    printed: issued.filter((tag) => tag.printed).length,
    issued: issued.length,
  };
}

// Pieces that passed QC across the batch, as the studio's header line reports them.
export function passedQcPieces(variants) {
  return variants.reduce((sum, variant) => {
    const semiPieces = variant.tags.filter((tag) => tag.kind === "parent" && tag.type === "BUNDLE").reduce((n, tag) => n + tag.piecesPerSet, 0);
    return sum + variant.sets * variant.piecesPerSet + semiPieces + variant.loose - variant.defects;
  }, 0);
}

// The shape the shared Tag Studio preview/print components draw. `code` is the readable id shown on
// the label; `qrValue` is what the QR encodes — the real scannable short code once the tag has one.
export function toDisplayTag(variant, tag, { engine, thermalPreset, a4Preset, typography, qrmm, fieldsOnCount }) {
  return {
    id: tag.key,
    kind: tag.kind,
    code: tag.displayCode,
    qrValue: tag.code ?? tag.displayCode,
    isSemiSet: tag.semi,
    composition: tag.composition,
    piecesPerSet: tag.piecesPerSet,
    size: tag.size,
    parentId: tag.parentDisplayCode,
    pricePerPiece: tag.pricePerPiece,
    printed: tag.printed,
    isNew: !tag.code,
    variant: {
      key: `tx-${variant.transactionId}`,
      designCode: variant.design.code,
      designName: variant.design.name,
      colorName: variant.variant.colorName,
      colorHex: variant.variant.colorHex,
      code: variant.variant.code,
      sellingPricePerPiece: variant.sellingPricePerPiece,
    },
    flags: flagsForTag(engine, thermalPreset, a4Preset, typography, qrmm, fieldsOnCount(tag.kind)),
  };
}

// The text a label is drawn from (consumed by buildTagLines / LabelTag / the PDF).
export function buildTagData(tag, { jobber, date }) {
  const variant = tag.variant;
  return {
    firm: FIRM_LABEL,
    designCode: variant.designCode,
    designName: variant.designName,
    variantName: (variant.colorName ?? "").toUpperCase(),
    composition: (tag.composition ?? []).join(" · "),
    piecesPerSet: tag.piecesPerSet ?? 0,
    isSemiSet: Boolean(tag.isSemiSet),
    jobber: jobber ? `#${jobber.toUpperCase()}` : "UNASSIGNED",
    piecePrice: `₹ ${(tag.pricePerPiece ?? variant.sellingPricePerPiece ?? 0).toLocaleString("en-IN")}`,
    date: formatDdMmYy(date),
    size: tag.size,
    parentSetId: tag.parentId,
    pieceId: tag.code,
  };
}

// One tag as the local print agent / confirmed A4 sheet expect it (see ConfirmedA4QrPrintSheet).
// Only used for a test print of a tag that already has a code — real prints use the `printItems`
// the issue endpoint returns.
export function toLabelItem(variant, tag) {
  const payload = { ...(tag.payload ?? {}) };
  if (tag.kind === "child" && tag.parentDisplayCode) payload.parentSetId = tag.parentDisplayCode;
  return {
    stockItemId: tag.stockItemId,
    type: tag.type === "LOOSE_PIECE" ? "PIECE" : tag.type,
    shortCode: tag.code,
    displayCode: tag.displayCode,
    payload,
    priceSnapshot: tag.pricePerPiece,
    sellingPricePerPiece: variant.sellingPricePerPiece,
    designSizeLabel: tag.size,
    parentStockItemId: tag.parentStockItemId,
    design: variant.design,
    variant: variant.variant,
    composition: tag.composition,
    piecesPerSet: tag.piecesPerSet,
  };
}
