import { z } from "zod";

export const listCurrentStockQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    keyword: z.string().trim().min(2, "Search keyword must be at least 2 characters").optional(),
});

export const currentStockDetailParamsSchema = z.object({
    colorVariantId: z.coerce.number().int().positive(),
});

// --- Current Stock overview / drawer / adjustments ---

const positiveInt = z.number().int().positive();
const reasonSchema = z.string().trim().min(1, "Choose a reason.").max(100);
const noteSchema = z.string().trim().max(500).optional();

export const colorVariantIdParamsSchema = z.object({
    colorVariantId: z.coerce.number().int().positive(),
});

export const adjustmentIdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const tagCodeParamsSchema = z.object({
    code: z.string().trim().min(1).max(40),
});

export const lowStockLevelSchema = z.object({
    lowStockLevel: z.number().int().min(0).max(100000),
});

export const addStockSchema = z
    .object({
        colorVariantId: positiveInt,
        kind: z.enum(["SETS", "SEMI", "LOOSE"]),
        sets: positiveInt.optional(),
        semiSet: z.object({
            designSizeIds: z.array(positiveInt).min(2, "Pick at least 2 sizes for a semi set."),
            count: positiveInt,
        }).optional(),
        loosePieces: z.array(z.object({ designSizeId: positiveInt, quantity: z.number().int().min(0) })).default([]),
        reason: reasonSchema,
        note: noteSchema,
    })
    .superRefine((data, ctx) => {
        if (data.kind === "SETS" && !data.sets) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sets"], message: "Enter the number of complete sets." });
        }
        if (data.kind === "SEMI") {
            if (!data.semiSet) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["semiSet"], message: "Pick the semi set's sizes." });
            } else if (new Set(data.semiSet.designSizeIds).size !== data.semiSet.designSizeIds.length) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["semiSet", "designSizeIds"], message: "Each size can only be picked once." });
            }
        }
        if (data.kind === "LOOSE") {
            if (!data.loosePieces.some((piece) => piece.quantity > 0)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["loosePieces"], message: "Enter at least one loose piece." });
            }
            const ids = data.loosePieces.map((piece) => piece.designSizeId);
            if (new Set(ids).size !== ids.length) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["loosePieces"], message: "Each size can only appear once." });
            }
        }
    });

export const writeOffSchema = z
    .object({
        colorVariantId: positiveInt,
        stockItemIds: z.array(positiveInt).default([]),
        loosePieces: z.array(z.object({ designSizeId: positiveInt, quantity: z.number().int().min(0) })).default([]),
        reason: reasonSchema,
        note: noteSchema,
    })
    .refine((data) => data.stockItemIds.length > 0 || data.loosePieces.some((piece) => piece.quantity > 0), {
        message: "Select at least one tag or loose piece to write off.",
        path: ["stockItemIds"],
    });

export const reverseAdjustmentSchema = z.object({
    note: z.string().trim().min(1, "Add a short reason for the reversal.").max(500),
});
