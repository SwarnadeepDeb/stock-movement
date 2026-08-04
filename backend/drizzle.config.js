import "dotenv/config.js";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./src/database/schema.js",
    out: "./src/database/migrations",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL,
    },
});
