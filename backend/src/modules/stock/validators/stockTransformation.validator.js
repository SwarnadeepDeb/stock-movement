import { z } from "zod";

const positiveInt = z.number().int().positive();
const custodyType = z.enum(["STOCK", "DISPLAY", "SALESPERSON", "SAMPLE", "ALTERATION"]);
const holder = z.string().trim().max(150).optional();

export const codeParamsSchema = z.object({
    // A short code, or the JSON payload a QR Center label encodes.
    code: z.string().trim().min(1).max(400),
});

export const colorVariantIdParamsSchema = z.object({
    colorVariantId: z.coerce.number().int().positive(),
});

export const transformationIdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const breakSchema = z.object({
    unitStockItemId: positiveInt,
    // One per piece, in the order GET /units/:code returned its slots.
    destinations: z.array(z.object({ custodyType, holder })).min(1),
    reason: z.string().trim().min(1, "Choose why the set is being broken.").max(150),
    note: z.string().trim().max(500).optional(),
});

export const formSchema = z.object({
    colorVariantId: positiveInt,
    kind: z.enum(["SET", "SEMI"]),
    stockItemIds: z.array(positiveInt).min(2, "Pick at least 2 pieces."),
    note: z.string().trim().max(500).optional(),
});

export const moveSchema = z.object({
    stockItemIds: z.array(positiveInt).min(1, "Scan at least one piece."),
    custodyType,
    holder,
    reason: z.string().trim().max(150).optional(),
});

export const undoSchema = z.object({
    note: z.string().trim().max(500).optional(),
});
