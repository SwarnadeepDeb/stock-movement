import fs from "node:fs";
import pg from "pg";

const [, , sqlFile, which] = process.argv;
const envFile = which === "test" ? ".env.test" : ".env";
const key = which === "test" ? "TEST_DATABASE_URL" : "DATABASE_URL";
const url = fs.readFileSync(envFile, "utf8").match(new RegExp(`${key}=(.*)`))[1].trim();

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
    await client.query("BEGIN");
    await client.query(fs.readFileSync(sqlFile, "utf8"));
    await client.query("COMMIT");
    console.log("applied", sqlFile, "to", which === "test" ? "TEST db" : "main db");
} catch (error) {
    await client.query("ROLLBACK");
    console.error("FAILED, rolled back:", error.message);
    process.exitCode = 1;
} finally {
    await client.end();
}
