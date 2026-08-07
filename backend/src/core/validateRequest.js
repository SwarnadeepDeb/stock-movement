import ApiError from "./apiError.js";

// Express middleware factory: validates req[source] against a Zod schema.
// On success the parsed (defaulted/coerced) data replaces req.body, or is
// stashed on req.validatedQuery for source "query" — req.query is a
// getter-only property in Express 5 and can't be reassigned.
export const validateRequest = (schema, source = "body") => (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
        const message = result.error.issues
            .map((issue) => `${issue.path.join(".") || source}: ${issue.message}`)
            .join("; ");

        return next(new ApiError(message, 400, "VALIDATION_ERROR"));
    }

    if (source === "query") {
        req.validatedQuery = result.data;
    } else {
        req[source] = result.data;
    }
    next();
};
