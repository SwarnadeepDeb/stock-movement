import { z } from "zod";

export const tagPresetParamsSchema = z.object({
    designId: z.coerce.number().int().positive(),
});

export const upsertTagPresetSchema = z.object({
    presetName: z.string().trim().min(1).max(100),
    mediaSize: z.string().trim().min(1).max(50),
    defaultPrinterId: z.number().int().positive().optional(),
    config: z.record(z.string(), z.any()).optional(),
});
