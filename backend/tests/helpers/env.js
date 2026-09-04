// The suite truncates tables, so it must never be pointed at a database anyone cares about.
// TEST_DATABASE_URL is required rather than defaulted: silently falling back to DATABASE_URL
// would wipe the development database the first time someone typed `pnpm test`.
import "dotenv/config.js";
import { config } from "dotenv";

config({ path: ".env.test", override: true });

if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
        "TEST_DATABASE_URL is not set. Copy .env.test.example to .env.test and point it at a " +
        "disposable database — the test suite truncates tables and must not run against the " +
        "database in .env.",
    );
}

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

// src/config/env.js validates the whole environment at import time and calls process.exit(1) on
// a miss, which would kill the run before any test reports. Cloudinary credentials are required
// there but unused by anything under test, so supply placeholders rather than requiring every
// developer to hold real ones to run the suite.
process.env.CLOUDINARY_CLOUD_NAME ??= "test-cloud";
process.env.CLOUDINARY_API_KEY ??= "test-key";
process.env.CLOUDINARY_API_SECRET ??= "test-secret";
