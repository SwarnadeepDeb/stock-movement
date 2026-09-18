import { getVariantKey } from "./variantKey";

const toPositiveEntries = (record) =>
  Object.entries(record)
    .map(([id, quantity]) => ({ id: Number(id), quantity: Number(quantity) }))
    .filter((item) => item.quantity > 0);

const hasStock = (config) =>
  config.totalSetsSold > 0 || config.bundles.length > 0 || toPositiveEntries(config.loosePieces).length > 0;

// Flattens the per-variant config map (keyed by UI-only variantKey) into the
// designs -> variants shape the Register Stock Out API expects. A selected variant nobody
// entered any sale quantity for is skipped rather than sent empty — same convention as
// buildStockInPayload.
export function buildStockOutPayload(selectedVariants, configs) {
  const designs = new Map();

  for (const variant of selectedVariants) {
    const config = configs[getVariantKey(variant)];
    if (!config || !hasStock(config)) continue;

    const variantEntry = {
      colorVariantId: config.colorVariantId,
      unitPrice: Number(config.unitPrice) || 0,
      totalSetsSold: config.totalSetsSold,
      bundles: config.bundles.map((bundle) => ({
        stockGroupId: bundle.stockGroupId,
        quantity: bundle.quantity,
      })),
      loosePieces: toPositiveEntries(config.loosePieces).map(({ id, quantity }) => ({
        designSizeId: id,
        quantity,
      })),
    };

    if (!designs.has(config.designId)) {
      designs.set(config.designId, []);
    }
    designs.get(config.designId).push(variantEntry);
  }

  return {
    designs: Array.from(designs, ([designId, variants]) => ({ designId, variants })),
  };
}
