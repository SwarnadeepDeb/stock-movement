import { z } from "zod";

const optionalText = (max) => z.string().trim().max(max).optional();

// Mobile and GST accept whatever the user types. The prototype's own sample data uses spaced
// mobiles ("98250 11210"), and a wholesaler copying a GST number off a card should never be
// blocked by a format rule that is wrong for some state or a foreign buyer.
const partyBodyShape = {
    name: z.string().trim().min(1, "Party name is required.").max(200),
    mobile: optionalText(20),
    city: optionalText(100),
    gst: optionalText(20),
    transport: optionalText(200),
    agent: optionalText(100),
};

export const createPartySchema = z.object(partyBodyShape);

export const updatePartySchema = z.object(partyBodyShape);

export const partyStatusSchema = z.object({ isActive: z.boolean() });

export const partyIdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const listPartiesQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(200).default(50),
    q: z.string().trim().optional(),
    // z.coerce.boolean() treats the string "false" as true, so compare explicitly instead.
    includeInactive: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
});
