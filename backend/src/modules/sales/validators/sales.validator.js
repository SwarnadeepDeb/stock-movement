import { z } from "zod";

const optionalText = (max) => z.string().trim().max(max).optional();

// The six party fields as they appear on a document. Identical to the party master's shape
// because they are a snapshot of it.
const partySchema = z.object({
    name: z.string().trim().min(1, "Party name is required.").max(200),
    mobile: optionalText(20),
    city: optionalText(100),
    gst: optionalText(20),
    transport: optionalText(200),
    agent: optionalText(100),
});

// "document": keep the typed details on this document only. "master": also update Party Master.
// The client asks the user; this records their answer.
const partySyncSchema = z.enum(["document", "master"]).default("document");

const documentNumber = z.string().trim().min(1, "Number is required.").max(50);

const isoDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD.");

export const orderFormBodySchema = z.object({
    formNumber: documentNumber,
    formDate: isoDate.optional(),
    partyId: z.coerce.number().int().positive().optional().nullable(),
    party: partySchema,
    partySync: partySyncSchema,
    salesman: z.string().trim().max(60).optional(),
    notes: z.string().trim().max(2000).optional(),
    items: z.array(z.object({
        colorVariantId: z.coerce.number().int().positive(),
        quantityPcs: z.coerce.number().int().positive("Quantity must be at least 1."),
    })).min(1, "Add at least one design."),
}).superRefine((data, ctx) => {
    const seen = new Set();

    for (const [index, item] of data.items.entries()) {
        if (seen.has(item.colorVariantId)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["items", index, "colorVariantId"],
                message: "This variant appears twice — combine the quantities into one line.",
            });
        }
        seen.add(item.colorVariantId);
    }
});

export const invoiceBodySchema = z.object({
    invoiceNumber: documentNumber,
    invoiceDate: isoDate.optional(),
    orderFormId: z.coerce.number().int().positive(),
    partyId: z.coerce.number().int().positive().optional().nullable(),
    party: partySchema,
    partySync: partySyncSchema,
    ticks: z.record(z.string(), z.boolean()).optional(),
    scans: z.array(z.object({
        scanCode: z.string().trim().min(1).max(32),
        method: z.enum(["Manual", "QR Scanner", "QR Gun"]).default("Manual"),
    })).min(1, "Scan at least one set or piece."),
});

// An edit does not move the invoice to another order form: that would rewrite which checklist it
// was picked against. Only the tags, party details and number can change.
export const invoiceUpdateSchema = invoiceBodySchema.omit({ orderFormId: true }).extend({
    orderFormId: z.coerce.number().int().positive().optional(),
});

export const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });

export const numberParamsSchema = z.object({ number: z.string().trim().min(1).max(50) });

export const listQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(200).default(50),
    q: z.string().trim().optional(),
    status: z.enum(["OPEN", "INVOICED", "CANCELLED"]).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
});

export const checkNumberQuerySchema = z.object({
    number: z.string().trim().min(1).max(50),
    excludeId: z.coerce.number().int().positive().optional(),
});

export const scanQuerySchema = z.object({
    // A bare shortCode, or a whole JSON label payload (see ScanResolverService._toShortCode).
    code: z.string().trim().min(1).max(500),
    invoiceId: z.coerce.number().int().positive().optional(),
    // Codes already on the picking screen, so a re-scan is reported as a duplicate rather than
    // silently accepted.
    scanned: z.string().trim().optional().transform((value) => value ? value.split(",").map((code) => code.trim()).filter(Boolean) : []),
});

export const galleryQuerySchema = z.object({
    mode: z.enum(["orderForm", "invoice", "all"]).default("all"),
    number: z.string().trim().max(50).optional(),
    q: z.string().trim().optional(),
    designId: z.coerce.number().int().positive().optional(),
    stock: z.enum(["all", "in", "out"]).default("all"),
}).superRefine((data, ctx) => {
    if (data.mode !== "all" && !data.number) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["number"],
            message: `A ${data.mode === "invoice" ? "invoice" : "order form"} number is required for this mode.`,
        });
    }
});

// An empty query is valid: it asks for the designs to offer before anything has been typed.
export const designSearchQuerySchema = z.object({
    q: z.string().trim().max(100).default(""),
});

export const designIdParamsSchema = z.object({ designId: z.coerce.number().int().positive() });
