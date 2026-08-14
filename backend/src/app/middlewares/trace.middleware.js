import { randomUUID } from 'node:crypto';

export const TRACE_ID_HEADER = 'x-trace-id';

// Attaches a trace ID to every incoming request.
export function traceMiddleware(req, res, next) {
    const traceId = req.headers[TRACE_ID_HEADER] || randomUUID();

    // make available throughout the request lifecycle
    req.headers[TRACE_ID_HEADER] = traceId;

    // return to client for correlation
    res.setHeader(TRACE_ID_HEADER, traceId);

    next();
}
