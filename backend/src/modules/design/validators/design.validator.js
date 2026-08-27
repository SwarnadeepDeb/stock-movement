import { z } from "zod";

const nonNegativeInt = z.number().int().nonnegative();

// multipart/form-data can only carry flat text fields — colorVariants/designSizes arrive
// as a JSON-stringified field on this route, so they need parsing back into arrays before
// the shape below can validate them. Plain JSON requests (already-parsed arrays) pass through.
const jsonField = (schema) =>
    z.preprocess((value) => {
        if (typeof value !== "string") return value;
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }, schema);

const colorVariantInputSchema = z.object({
    colorName: z.string().trim().min(1),
    colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "colorHex must be a hex color like #FF0000"),
});

const designSizeInputSchema = z.object({
    sizeLabel: z.string().trim().min(1),
    displayOrder: nonNegativeInt.default(0),
    unsetPricePerSize: z.number().nonnegative().optional(),
    includedInSet: z.boolean().default(true),
});

// A semi set names a subset of the sizes submitted in colorVariants' full set — sizeLabels are
// re-matched against the created designSize rows per variant in the service layer (see
// DesignService.registerDesign), since designSizeId doesn't exist yet at validation time.
const designSemiSetInputSchema = z.object({
    label: z.string().trim().min(1),
    displayOrder: nonNegativeInt.default(0),
    sizeLabels: z.array(z.string().trim().min(1)).min(1, "A semi set needs at least one size"),
});

export const listDesignsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    // Design Master dashboard search/sort — optional, so older callers behave as before.
    keyword: z.string().trim().max(100).optional().transform((value) => value || undefined),
    sort: z.enum(["new", "old", "price_asc", "price_desc", "code"]).default("new"),
});

export const designIdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const searchDesignsQuerySchema = z.object({
    keyword: z.string().trim().min(2, "Search keyword must be at least 2 characters"),
});

export const searchJobbersQuerySchema = z.object({
    keyword: z.string().trim().min(2, "Search keyword must be at least 2 characters"),
});

export const searchQualitiesQuerySchema = z.object({
    keyword: z.string().trim().min(2, "Search keyword must be at least 2 characters"),
});

export const searchPatternsQuerySchema = z.object({
    keyword: z.string().trim().min(2, "Search keyword must be at least 2 characters"),
});

export const colorVariantSizesParamsSchema = z.object({
    colorVariantId: z.coerce.number().int().positive(),
});

// Design Code: mandatory, letters and digits in any order (must contain at least one of each),
// optionally split by single spaces (older codes like "kpd 100"), at most 30 letters + digits
// (spaces aren't counted). Always stored in lowercase.
export const DESIGN_CODE_MAX_LENGTH = 30;
const designCodeField = z.string({ error: "Design Code is required." })
    .transform((value) => value.trim().replace(/\s+/g, " ").toLowerCase())
    .pipe(z.string()
        .min(1, "Design Code is required.")
        .regex(/^[a-z0-9]+(?: [a-z0-9]+)*$/, "Design Code can contain only letters and numbers.")
        .refine((code) => /[a-z]/.test(code) && /[0-9]/.test(code), "Design Code must contain both letters and numbers (e.g. kp100).")
        .refine((code) => code.replace(/ /g, "").length <= DESIGN_CODE_MAX_LENGTH, `Design Code must be at most ${DESIGN_CODE_MAX_LENGTH} characters.`));

// Name fields (Item Name, Pattern, Quality, Jobber name): letters only, with single spaces or
// hyphens between words (so "Co-ord Set" / "Up-Down" are allowed), at most 50 characters.
// Whitespace is trimmed and collapsed before checking. Kept in step with frontend nameRules.js.
export const NAME_MAX_LENGTH = 50;
const LETTERS_PATTERN = /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/;
const lettersOnlyField = (label, requiredMessage = `${label} is required.`) => z.string({ error: requiredMessage })
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .pipe(z.string()
        .min(1, requiredMessage)
        .max(NAME_MAX_LENGTH, `${label} must be at most ${NAME_MAX_LENGTH} characters.`)
        .regex(LETTERS_PATTERN, `${label} can contain letters only (spaces and hyphens between words are allowed).`));

// Item Name is additionally stored in capitals.
const itemNameField = lettersOnlyField("Item Name").transform((value) => value.toUpperCase());
const patternNameField = lettersOnlyField("Pattern");
const qualityField = lettersOnlyField("Quality");
const jobberNameField = lettersOnlyField("Jobber name", "Jobber name cannot be blank.").optional();

// Notes: optional, at most 300 characters (matches the designs.notes column width).
export const NOTES_MAX_LENGTH = 300;
const notesField = z.string().trim().max(NOTES_MAX_LENGTH, `Notes must be at most ${NOTES_MAX_LENGTH} characters.`).optional();

export const registerDesignSchema = z.object({
    // Pattern (e.g. Anarkali/Straight/Flair) is required, same as quality: name carries the
    // typed/selected name, patternId optionally selects an existing pattern by id. Backend
    // re-validates patternId rather than trusting it outright — see DesignService._resolvePattern.
    name: patternNameField,
    patternId: z.coerce.number().int().positive().optional(),

    code: designCodeField,
    // Same contract as quality below: itemName carries the typed/selected name, itemNameId
    // optionally selects an existing item name by id — see DesignService._resolveItemName.
    itemName: itemNameField,
    itemNameId: z.coerce.number().int().positive().optional(),

    // Quality is required (unlike jobber): quality carries the typed/selected name, qualityId
    // optionally selects an existing quality by id. Backend re-validates qualityId rather than
    // trusting it outright — see DesignService._resolveQuality.
    quality: qualityField,
    qualityId: z.coerce.number().int().positive().optional(),

    defaultSellingPricePerPiece: z.coerce.number().int().nonnegative(),
    notes: notesField,

    // Jobber is optional (backward compatible with designs registered before this field
    // existed): jobberId selects an existing jobber, jobberName resolves/creates one by name
    // when no id is given — see DesignService._resolveJobberId. Backend re-validates jobberId
    // rather than trusting it outright.
    jobberId: z.coerce.number().int().positive().optional(),
    jobberName: jobberNameField,

    // one image is required per entry — enforced against the uploaded file count in the
    // service layer, since multer's file count isn't part of req.body and can't be checked here
    colorVariants: jsonField(z.array(colorVariantInputSchema).min(1, "At least one color variant is required")),
    designSizes: jsonField(z.array(designSizeInputSchema)).default([]),
    semiSets: jsonField(z.array(designSemiSetInputSchema)).default([]),
});

// Design Master edit (multipart, like register). colorVariants lists every variant the design
// should have afterwards: an entry with `id` keeps/edits that variant (replaceImage: true means a
// new photo is attached for it), an entry without `id` is a new variant (photo required), and any
// existing variant left out is removed (refused while it has stock — see DesignMasterService).
const editVariantInputSchema = colorVariantInputSchema.extend({
    id: z.number().int().positive().optional(),
    replaceImage: z.boolean().optional(),
});

export const updateDesignSchema = z.object({
    name: patternNameField,
    patternId: z.coerce.number().int().positive().optional(),
    code: designCodeField,
    itemName: itemNameField,
    itemNameId: z.coerce.number().int().positive().optional(),
    quality: qualityField,
    qualityId: z.coerce.number().int().positive().optional(),
    defaultSellingPricePerPiece: z.coerce.number().int().nonnegative(),
    notes: notesField,
    jobberId: z.coerce.number().int().positive().optional(),
    jobberName: jobberNameField,
    colorVariants: jsonField(z.array(editVariantInputSchema).min(1, "At least one color variant is required")),
    designSizes: jsonField(z.array(designSizeInputSchema).min(1, "Select at least one size")),
    semiSets: jsonField(z.array(designSemiSetInputSchema)).default([]),
});

// --- Design drafts ---

// `state` is the wizard's own form snapshot — only its outer shape is checked here; nothing in it
// is trusted for registration, which re-validates via registerDesignSchema when the draft is used.
export const designDraftSchema = z.object({
    currentStep: z.number().int().min(0).max(2).default(0),
    state: z.record(z.string(), z.unknown()),
});
