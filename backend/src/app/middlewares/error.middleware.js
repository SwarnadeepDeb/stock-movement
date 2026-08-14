import ApiError from '../../core/apiError.js';
import logger from '../../config/logger.js';
import {TRACE_ID_HEADER} from "./trace.middleware.js";

const isDev = process.env.NODE_ENV === "development";

function parseDbError(error) {
    const cause = error?.cause || error?.originalError?.cause;

    if (!cause) return null;

    if (cause.code === "23505") {
        return new ApiError(
            cause.detail || "Duplicate value violates unique constraint",
            409,
            "DUPLICATE_RESOURCE"
        );
    }

    if (cause.code === "23502") {
        return new ApiError(
            cause.column + " cannot be null",
            400,
            "NOT_NULL_VIOLATION"
        );
    }

    if (cause.code === "23503") {
        return new ApiError(
            "Referenced resource does not exist",
            400,
            "FOREIGN_KEY_VIOLATION"
        );
    }

    return null;
}

const errorHandler = (err, req, res, next) => {

    const dbError = parseDbError(err);

    if (dbError) {
        err = dbError;
    }

    // normalize unknown errors
    if (!(err instanceof ApiError)) {
        err = new ApiError(err, 500, "INTERNAL_ERROR", false);
    }

    const statusCode = err.statusCode || 500;
    const traceId = req.traceId || req.headers[TRACE_ID_HEADER];

    // logging
    const isMissingStockInDraft =
        statusCode === 404 &&
        req.method === 'GET' &&
        /\/stock-in\/drafts\/\d+$/.test(req.originalUrl);

    const logError = isMissingStockInDraft ? logger.warn.bind(logger) : logger.error.bind(logger);
    logError({
        err,
        traceId,
        path: req.originalUrl,
        method: req.method,
    }, isMissingStockInDraft ? "Stock In draft no longer exists." : "Request failed");

    const response = {
        error: {
            code: err.code,
            message: err.message,
            traceId,
            timestamp: new Date().toISOString(),
        },
    };

    // dev debugging info
    if (isDev) {
        const cause = err.originalError?.cause;

        response.error.debug = {
            stack: err.stack,
            originalError: err.originalError
                ? {
                    name: err.originalError.name,
                    message: err.originalError.message,
                }
                : undefined,
            postgres: cause
                ? {
                    code: cause.code,
                    detail: cause.detail,
                    constraint: cause.constraint,
                    table: cause.table,
                    column: cause.column,
                }
                : undefined,
        };
    }

    res.status(statusCode).json(response);
};

export default errorHandler;
