import { z } from "zod";

export const listStockHistoryQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    keyword: z.string().trim().min(2, "Search keyword must be at least 2 characters").optional(),
    eventType: z.enum(["STOCK_IN", "SET_ASSEMBLED", "BUNDLE_ASSEMBLED", "STOCK_OUT", "STOCK_ADJUSTED_IN", "STOCK_ADJUSTED_OUT"]).optional(),
    colorVariantId: z.coerce.number().int().positive().optional(),
    // Same plain date-string convention as stockDate in stockIn.validator.js — the repository
    // is responsible for widening these to inclusive day boundaries.
    dateFrom: z.string().date().optional(),
    dateTo: z.string().date().optional(),
}).superRefine((data, ctx) => {
    if (data.dateFrom && data.dateTo && data.dateFrom > data.dateTo) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["dateTo"],
            message: "dateTo must not be before dateFrom.",
        });
    }
});
