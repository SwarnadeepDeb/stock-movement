import { z } from "zod";

export const stockItemStatusSchema = z.object({
    status: z.enum(["SET", "UNSET"]),
});

export const assembleSetSchema = z.object({
    colorVariantId: z.number().int().positive(),
    quantity: z.number().int().positive().default(1),
});

export const looseAvailabilityParamsSchema = z.object({
    colorVariantId: z.coerce.number().int().positive(),
});

// The composition is never accepted from the caller — stockGroupId identifies one of the
// variant's existing BUNDLE stock groups, and the backend resolves its authoritative
// composition server-side (see stockItem.service.js's assembleBundle).
export const assembleBundleSchema = z.object({
    colorVariantId: z.number().int().positive(),
    stockGroupId: z.number().int().positive(),
    quantity: z.number().int().positive().default(1),
});
