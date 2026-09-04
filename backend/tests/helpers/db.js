import { sql } from "drizzle-orm";
import { db } from "../../src/database/index.js";
import { closePool } from "../../src/database/connection.js";

// Truncates only the tables a suite names, rather than every table — a suite that touches
// parties has no business deleting anyone's designs or stock.
export async function truncate(tables) {
    if (tables.length === 0) return;
    const list = tables.map((table) => `"${table}"`).join(", ");
    await db.execute(sql.raw(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`));
}

export async function disconnect() {
    await closePool();
}

export { db };
