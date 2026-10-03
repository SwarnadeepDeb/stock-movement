// What an order's lines already hold for one design: colorVariantId -> pieces requested.
export const existingFor = (lines, designId) =>
    new Map(lines.filter((line) => line.designId === designId).map((line) => [line.colorVariantId, line.quantityPcs]));
