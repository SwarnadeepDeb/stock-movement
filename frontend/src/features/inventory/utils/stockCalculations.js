export const sumQuantities = (record) =>
  Object.values(record).reduce((sum, quantity) => sum + (Number(quantity) || 0), 0);

export const getBundlePiecesPerBundle = (composition) => sumQuantities(composition);

export const getBundleTotalPieces = (bundle) =>
  getBundlePiecesPerBundle(bundle.composition) * (Number(bundle.quantity) || 0);

export const getLoosePiecesTotal = (loosePieces) => sumQuantities(loosePieces);
