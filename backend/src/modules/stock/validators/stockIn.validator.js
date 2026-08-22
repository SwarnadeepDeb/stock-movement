import { z } from "zod";

const positiveInt = z.number().int().positive();
const nonNegativeInt = z.number().int().nonnegative();

const compositionItemSchema = z.object({
    designSizeId: positiveInt,
    quantity: positiveInt,
});

const bundleSchema = z
    .object({
        bundleNumber: positiveInt.optional(),
        quantity: positiveInt,
        composition: z.array(compositionItemSchema).min(1),
    })
    .superRefine((bundle, ctx) => {
        const seen = new Set();
        for (const [index, item] of bundle.composition.entries()) {
            if (seen.has(item.designSizeId)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["composition", index, "designSizeId"],
                    message: `Duplicate designSizeId ${item.designSizeId} within a single bundle's composition.`,
                });
            }
            seen.add(item.designSizeId);
        }
    });

const loosePieceSchema = z.object({
    designSizeId: positiveInt,
    quantity: positiveInt,
});

const taggingSchema = z.object({
    strategy: z.enum(["parent", "parentChild", "custom"]).default("parent"),
    // Only meaningful when strategy === "custom" — mirrors the frontend's per-variant
    // qrPerVariantSettings.childTags override (see qrTagStudio.js#computeVariantRow).
    childTagsEnabled: z.boolean().default(false),
    // Independent of strategy: tags the loose-piece quantity individually (PIECE, not
    // LOOSE_PIECE) instead of leaving it in the untagged fungible pool.
    tagLoosePieces: z.boolean().default(false),
});

// Challan No. is a free-form supplier/delivery reference — may contain letters, digits,
// leading zeros, and separators like "/" or "-" (e.g. "CH-00125", "INV/2026/001", "001245").
// Never coerced to a number, so leading zeros survive.
const challanNoSchema = z
    .string()
    .trim()
    .min(1, "Challan No. is required.")
    .max(100, "Challan No. must be at most 100 characters.");

// One Color Variant's stock registration within the overall request.
const variantEntrySchema = z
    .object({
        colorVariantId: positiveInt,
        // Delivery Date: the actual date stock was received. Required — the frontend always
        // sends it (defaulted to today, editable) — and stored as a date-only string, never
        // parsed into a Date object here, so no UTC shift can occur before it reaches the DB.
        // Optional per variant: the challan-level values below are authoritative and are applied
        // to every variant by the service.
        stockDate: z.string().date().optional(),
        challanNo: challanNoSchema.optional(),
        // QC outcome — pieces that failed inspection and the reason. A category is mandatory
        // whenever any piece is defective (checked in the superRefine below).
        defectivePieces: nonNegativeInt.default(0),
        defectCategory: z.string().trim().max(100).optional(),
        notes: z.string().max(1000).optional(),
        totalSetsReceived: nonNegativeInt.default(0),
        bundles: z.array(bundleSchema).default([]),
        loosePieces: z.array(loosePieceSchema).default([]),
        tagging: taggingSchema.default({ strategy: "parent", childTagsEnabled: false, tagLoosePieces: false }),
        // First QR serial the Tag Studio printed for this variant (sets / pieces); checked against
        // the live counters so labels printed from stale numbers are rejected, not saved.
        serialStart: z.object({ set: positiveInt.optional(), piece: positiveInt.optional() }).optional(),
    })
    .superRefine((variant, ctx) => {
        const hasSets = variant.totalSetsReceived > 0;
        const hasBundles = variant.bundles.length > 0;
        const hasLoosePieces = variant.loosePieces.length > 0;

        if (!hasSets && !hasBundles && !hasLoosePieces) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [],
                message: "Each variant must include at least one of totalSetsReceived, bundles, or loosePieces.",
            });
        }

        if (variant.defectivePieces > 0 && !variant.defectCategory) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["defectCategory"],
                message: "Pick a defect category when a variant has defective pieces.",
            });
        }

        const seen = new Set();
        for (const [index, piece] of variant.loosePieces.entries()) {
            if (seen.has(piece.designSizeId)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["loosePieces", index, "designSizeId"],
                    message: `Duplicate designSizeId ${piece.designSizeId} across loosePieces.`,
                });
            }
            seen.add(piece.designSizeId);
        }
    });

// One Design's group of Color Variant registrations within the overall request.
const designGroupSchema = z.object({
    designId: positiveInt,
    variants: z.array(variantEntrySchema).min(1),
});

const todayIso = () => new Date().toISOString().slice(0, 10);

// The jobber delivery as a whole: one challan, however many designs/variants it carries.
const challanSchema = z.object({
    jobberName: z.string().trim().min(1, "Select the jobber.").max(150),
    challanNo: challanNoSchema,
    issuedChallanNo: z.string().trim().min(1, "Issued challan number is required.").max(100),
    stockDate: z.string().date().refine((value) => value <= todayIso(), "Inward date can't be in the future."),
    remarks: z.string().trim().max(1000).optional(),
    defectAction: z.enum(["seconds", "return"]).default("seconds"),
});

export const stockInSchema = z
    .object({
        challan: challanSchema,
        designs: z.array(designGroupSchema).min(1),
        printOnConfirm: z.boolean().default(false),
        printerId: positiveInt.optional(),
        // Stock In draft this registration was completed from — deleted on success.
        draftId: positiveInt.optional(),
    })
    .superRefine((data, ctx) => {
        if (data.printOnConfirm && data.printerId === undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["printerId"],
                message: "printerId is required when printOnConfirm is true.",
            });
        }

        const seenDesignIds = new Set();
        data.designs.forEach((design, designIndex) => {
            if (seenDesignIds.has(design.designId)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["designs", designIndex, "designId"],
                    message: `Duplicate designId ${design.designId} — group all of a design's variants under a single entry.`,
                });
            }
            seenDesignIds.add(design.designId);
        });

        // colorVariantId must be unique across the ENTIRE request, not just within one design.
        const seenColorVariantIds = new Set();
        data.designs.forEach((design, designIndex) => {
            design.variants.forEach((variant, variantIndex) => {
                if (seenColorVariantIds.has(variant.colorVariantId)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["designs", designIndex, "variants", variantIndex, "colorVariantId"],
                        message: `Duplicate colorVariantId ${variant.colorVariantId} across the request.`,
                    });
                }
                seenColorVariantIds.add(variant.colorVariantId);
            });
        });
    });

// --- Stock In drafts ---

export const stockInDraftIdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

// `state` is the wizard's own client-side snapshot — only its outer shape is checked here;
// nothing in it is trusted for registration, which re-validates via stockInSchema on confirm.
export const stockInDraftSchema = z.object({
    currentStep: z.number().int().min(0).max(4).default(0),
    state: z.record(z.string(), z.unknown()),
});

// --- Stock In challans (the dashboard register) ---

export const stockInChallanIdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const stockInChallanListQuerySchema = z.object({
    search: z.string().trim().max(100).optional(),
    jobber: z.string().trim().max(150).optional(),
    // "7" | "30" | "90" = last N days, "90+" = older than 90 days, "custom" uses from/to.
    dateRange: z.enum(["7", "30", "90", "90+", "custom"]).optional(),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    status: z.enum(["active", "defects", "edited", "dropped", "all"]).default("active"),
    sort: z.enum(["new", "old", "pcs"]).default("new"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(500).default(8),
});

export const stockInChallanUpdateSchema = z.object({
    jobberName: z.string().trim().min(1).max(150),
    challanNo: challanNoSchema,
    issuedChallanNo: z.string().trim().max(100).optional(),
    stockDate: z.string().date(),
    remarks: z.string().trim().max(1000).optional(),
    reason: z.string().trim().min(1, "Add a short reason for the edit.").max(300),
});

export const stockInChallanDropSchema = z.object({
    reason: z.string().trim().min(1, "Add a reason.").max(300),
});

export const stockInChallanEventSchema = z.object({
    kind: z.enum(["PRINT", "PDF"]),
});

// --- QR serial counters ---

export const stockInSerialCountersQuerySchema = z.object({
    colorVariantIds: z
        .string()
        .transform((value) => value.split(",").map((id) => Number(id.trim())))
        .pipe(z.array(positiveInt).min(1).max(200)),
});
