import ApiError from "../../core/apiError.js";

// should be registered before the global error handler
export default function notFoundHandler(req, res, next) {
    const error = new ApiError(`Cannot ${req.method} ${req.originalUrl}`, 404, "ROUTE_NOT_FOUND");

    next(error);
}
