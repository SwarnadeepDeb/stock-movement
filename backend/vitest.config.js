import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        // Every suite talks to the same Postgres database and truncates between tests, so
        // parallel files would delete each other's rows mid-assertion.
        fileParallelism: false,
        setupFiles: ["./tests/helpers/env.js"],
        include: ["tests/**/*.test.js"],
        // Generous because the test database is normally remote (Neon), and a single invoice
        // test makes ~25 sequential round trips — seeding a design, its sizes, its stock items
        // and their QR codes, then billing them. On a local Postgres these finish in well under
        // a second; over the network the same test can take 20s, and a tight timeout turns that
        // into flakiness that looks like a logic bug.
        testTimeout: 120000,
        hookTimeout: 120000,
    },
});
