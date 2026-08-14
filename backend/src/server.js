import "dotenv/config.js";
import dns from "dns";
import http from "http";

import app from "./app.js";
import {env} from "./config/env.js";
import logger from "./config/logger.js";
import {closePool, verifyConnection} from "./database/connection.js";
// import {connectRedis} from "./infra/redis/redis.js";

// Node's default DNS lookup order can alternate between IPv4/IPv6 per call (Happy Eyeballs),
// which surfaces as intermittent ENOTFOUND for the same hostname on networks with flaky or
// absent IPv6 routing — exactly the pattern seen against the Neon pooler hostname. Pinning to
// IPv4 first makes resolution consistent instead of racing a route that may not work.
dns.setDefaultResultOrder("ipv4first");

const server = http.createServer(app);

async function startServer() {
    try {
        // Fail fast if DB is unreachable
        await verifyConnection();

        // Connect Redis
        // await connectRedis();

        server.listen(env.PORT, "0.0.0.0", () => { logger.info({port: env.PORT, env: env.NODE_ENV}, "User Service started!")});

    } catch (err) {
        logger.fatal(err, "Service failed to start");
        process.exit(1);
    }
}

startServer();

// prevent double shutdown, happens when both SIGTERM & SIGINT fires simultaneously in same container
let isShuttingDown = false;

// graceful shutdown
async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info({signal}, "Shutdown signal received");

    // clear forced shutdown timer if graceful exit succeeds
    const forceExit = setTimeout(() => {
        logger.warn("Forced shutdown after timeout");
        process.exit(1);
    }, 30_000);

    // allows timer to not block graceful exit
    forceExit.unref();

    try {
        // 1: stop accepting new HTTP connections
        await new Promise((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()));
        });
        logger.info("HTTP server closed");

        // 2: drain DB pool after HTTP is closed
        // so in-flight requests can finish their queries first
        closePool();
        logger.info("DB pool closed");

        logger.info("Graceful shutdown complete");
        clearTimeout(forceExit); // fix: cancel forced exit since we're done

        process.exit(0);
    } catch (err) {
        logger.error(err, "Shutdown error");
        process.exit(1);
    }
}

// handle process termination signals
process.on('SIGTERM', () => shutdown('SIGTERM')); // docker/k8s
process.on('SIGINT', () => shutdown('SIGINT')); // locally ctrl + c

process.on('unhandledRejection', (reason) => {
    logger.fatal({reason}, "Unhandled rejection — initiating shutdown");
    shutdown("unhandledRejection");
})

process.on('uncaughtException', (err) => {
    logger.fatal({err}, "Uncaught exception — initiating shutdown");
    // uncaughtException leaves process in undefined state, graceful shutdown is best-effort here
    shutdown("uncaughtException");
})
