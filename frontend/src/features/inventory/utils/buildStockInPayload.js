import { getVariantKey } from "./variantKey";

const toCompositionArray = (record) =>
  Object.entries(record)
    .map(([designSizeId, quantity]) => ({ designSizeId: Number(designSizeId), quantity: Number(quantity) }))
    .filter((item) => item.quantity > 0);

const hasStock = (config) =>
  config.totalSetsReceived > 0 ||
  config.bundles.some((bundle) => bundle.quantity > 0 && toCompositionArray(bundle.composition).length > 0) ||
  toCompositionArray(config.loosePieces).length > 0;

// Flattens the per-variant config map (keyed by UI-only variantKey) into the
// designs -> variants -> bundles/loosePieces shape the Register Stock In API expects.
// A selected variant nobody entered any stock for is skipped rather than sent empty.
// The jobber delivery (jobber, challan no., issued challan no., date, remarks, defect action) is
// entered once and sent as `challan`; the server stamps it on every variant's stock-in
// transaction. Each variant carries its own QC outcome (defective pieces + category).
// serialStarts: { [variantKey]: { set, piece } } from the QR Tag Studio.
// Tagging: Parent + Child on → "parentChild"; off → "parent" (sets/semi sets still get their
// codes issued, only the pieces aren't individually tagged). Loose tagging is per variant, taken
// from qrPerVariantSettings (StockIn.jsx fills it from the one Loose pieces switch).
export function buildStockInPayload(selectedVariants, configs, { challan, tagParentChild, qrPerVariantSettings, qcByKey, printOnConfirm, printerId, serialStarts }) {
  const designs = new Map();

  for (const variant of selectedVariants) {
    const key = getVariantKey(variant);
    const config = configs[key];
    if (!config || !hasStock(config)) continue;

    const perVariant = qrPerVariantSettings?.[key] ?? { included: true, childTags: false, tagLoosePieces: true };

    const defects = Number(qcByKey?.[key]?.defects) || 0;

    const variantEntry = {
      colorVariantId: config.colorVariantId,
      defectivePieces: defects,
      ...(defects > 0 ? { defectCategory: qcByKey[key].category } : {}),
      totalSetsReceived: config.totalSetsReceived,
      bundles: config.bundles
        .filter((bundle) => bundle.quantity > 0)
        .map(({ quantity, composition }) => ({
          quantity,
          composition: toCompositionArray(composition),
        }))
        .filter((bundle) => bundle.composition.length > 0),
      loosePieces: toCompositionArray(config.loosePieces),
      tagging: {
        strategy: tagParentChild ? "parentChild" : "parent",
        childTagsEnabled: Boolean(perVariant.childTags),
        tagLoosePieces: Boolean(perVariant.tagLoosePieces),
      },
      // First serials the labels were printed with — the server rejects the inward if another
      // one has used those numbers since.
      ...(serialStarts?.[key] ? { serialStart: serialStarts[key] } : {}),
    };

    if (!designs.has(config.designId)) {
      designs.set(config.designId, []);
    }
    designs.get(config.designId).push(variantEntry);
  }

  return {
    challan,
    designs: Array.from(designs, ([designId, variants]) => ({ designId, variants })),
    printOnConfirm: Boolean(printOnConfirm),
    ...(printerId ? { printerId } : {}),
  };
}
