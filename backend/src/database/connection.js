import { Pool } from "pg";
import { env } from "../config/env.js";
import logger from "../config/logger.js";

// configure pool for performance
export const pool = new Pool({
    connectionString: env.DATABASE_URL,

    max: env.DB_POOL_SIZE,
    // close idle connection after 10 sec to free resources
    idleTimeoutMillis: 30000,
    // Neon can take longer than 10 seconds to wake from an idle state.
    connectionTimeoutMillis: 30000,
    // keep the connection alive to prevent the network layer from dropping it
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
});

// pool lifecycle logs
logger.info({ maxConnections: env.DB_POOL_SIZE }, "PostgreSQL pool configured");

// handle Pool Errors, crucial for stability
pool.on('error', (err, client) => {
    logger.error({ err, component: "db-pool", }, "Unexpected error on idle PostgresSQL client" );
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Neon's serverless compute suspends when idle and can take longer than a single
// connectionTimeoutMillis to wake back up — retry a few times with backoff before
// giving up, so a cold start doesn't crash the whole service on startup.
// 3 attempts (~36s total budget including the 10s connectionTimeoutMillis per try)
// was measured too tight: a cold Neon endpoint can still be waking up past that
// point, so the service died with a false-negative "DB unreachable" before the
// endpoint ever finished starting. 6 attempts with a longer linear backoff gives
// roughly 2-3x the wait budget (~90s+) before genuinely giving up.
export async function verifyConnection({ retries = 6, delayMs = 3000 } = {}) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const client = await pool.connect(); // will throw if DB unreachable
            try {
                await client.query("SELECT 1");
                logger.info("PostgreSQL connection verified");
                return;
            } finally {
                client.release(); // always release back to pool
            }
        } catch (err) {
            if (attempt === retries) throw err;
            logger.warn({ err, attempt, retries }, "PostgreSQL connection attempt failed, retrying");
            await sleep(delayMs * attempt);
        }
    }
}

// graceful shutdown helper
export async function closePool() {
    try {
        logger.info("Closing PostgresSQL connection pool");
        await pool.end();
        logger.info("Database pool closed successfully!");
    } catch (err) {
        logger.error({ err, component: "db-pool" }, "Error closing PostgresSQL pool");
        throw err; // let server.js shutdown() handle exit(1)
    }
}
