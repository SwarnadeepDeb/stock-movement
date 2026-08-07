// root Pino instance — single source of truth. Central Pino logger configuration.

/*
design principles:
always writes raw NDJSON to stdout asynchronously via sonic-boom (main thread, non-blocking fs writes).
dev prettifies by piping that stdout through the pino-pretty CLI (see package.json's "dev" script) —
pino.transport()'s worker thread hangs indefinitely under `node --watch` in this ESM project, so
in-process pretty-printing is avoided entirely.
the log level is driven by LOG_LEVEL env var
*/

import os from 'node:os';
import pino from 'pino';
import {env} from "./env.js";

// constants
const LOG_LEVEL = env.LOG_LEVEL;
const NODE_ENV = env.NODE_ENV;
const SERVICE =  env.SERVICE_NAME;
const VERSION = env.SERVICE_VERSION;

// headers whose *values* must never appear in logs.
// note: reqSerializer/resSerializer below never forward `headers` at all, so these
// req.headers.*/res.headers.* paths are inert against logs produced through this logger's
// req/res serializers today — they're kept as defense-in-depth in case a future serializer
// change (e.g. switching to pino-http defaults) starts passing raw headers through.
// The wildcard paths *do* actively apply — they catch sensitive fields logged directly
// (e.g. `logger.info({ user })`, `logger.debug({ token })`) from anywhere else in the app.
const REDACTED_PATHS = [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["x-api-key"]',
    'req.headers["x-auth-token"]',
    'res.headers["set-cookie"]',
    '*.password',
    '*.token',
    '*.accessToken',
    '*.refreshToken',
    '*.secret',
    '*.apiKey',
    '*.authorization',
];

// request serializers: only the fields the gateway cares about.
function reqSerializer (req) {
    return ({
        id: req.id,
        method: req.method,
        url: req.url,
        remoteAddress: req.socket?.remoteAddress,
        userAgent: req.headers?.['user-agent'],
        contentType: req.headers?.['content-type'],
        // req.id is the canonical, server-generated identifier used for correlation.
        // x-correlation-id is client-supplied and untrusted (no gateway sits in front of
        // this service to validate it), so it's recorded separately rather than trusted
        // as the primary correlationId — a client could otherwise spoof/collide IDs.
        clientCorrelationId: req.headers?.['x-correlation-id'],
    })
}

// response serializers
function resSerializer (res) {
    return ({
        statusCode: res.statusCode,
    })
}

// error serializer — ensures stack traces are structurally present
function errSerializer (err) {
    return ({
        type: err?.constructor?.name ?? "Error",
        message: err?.message,
        stack: err?.stack,
        code: err?.code,
        statusCode: err?.statusCode ?? err?.status,
        // preserve Error.cause chains (Node's `new Error(msg, { cause })`) so wrapped
        // errors don't lose their root cause in logs
        cause: err?.cause instanceof Error ? errSerializer(err.cause) : err?.cause,
    })
}

// destination stream — always raw NDJSON via sonic-boom, prettified externally in dev
// (see package.json's "dev" script piping through the pino-pretty CLI).
// can emit 'error' (e.g. EPIPE/ENOSPC on stdout), which is otherwise an unhandled
// stream error and crashes the process.
const destination = pino.destination({ sync: false });
destination.on('error', (err) => {
    console.error('logger destination stream error:', err);
});

// root logger
const logger = pino(
    {
        level: LOG_LEVEL,

        // static field append to every log line
        // (pino's own default base is {pid, hostname} — since we override `base` entirely,
        // hostname must be re-added explicitly or it silently disappears)
        base: {
            service: SERVICE,
            version: VERSION,
            env: NODE_ENV,
            pid: process.pid,
            hostname: os.hostname(),
        },

        timestamp: pino.stdTimeFunctions.isoTime, // will cause CPU overhead when handling 1000 of req/sec

        // output the level label (e.g. "info") instead of pino's default numeric value,
        // since most log platforms outside pino-aware ones filter/alert on the string form
        formatters: {
            level (label) {
                return { level: label };
            },
        },

        serializers: {
            req: reqSerializer,
            res: resSerializer,
            err: errSerializer,
        },

        redact: {
            paths:  REDACTED_PATHS,
            censor: '[Redacted]',
        },
    },
    destination
)

// graceful flush on shutdown
const flushAndExit = (signal) => {
    logger.info({ signal }, 'Received shutdown signal — flushing log buffer');

    // safety net only — process.exit(1) here means flush() never called back in time
    const forceExit = setTimeout(() => process.exit(1), 5000);
    forceExit.unref();

    logger.flush((err) => {
        clearTimeout(forceExit);
        process.exit(err ? 1 : 0);
    });
}

// it's a node process
process.once("SIGTERM", () => flushAndExit("SIGTERM"));
process.once("SIGINT", () => flushAndExit("SIGINT"));

export default logger;
