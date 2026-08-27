import { eq, ilike } from "drizzle-orm";

import { db } from "../../../database/index.js";
import { pattern } from "../schemas/pattern.schema.js";

// keep suggestion lists small — this backs an autocomplete dropdown, not a data table
const MAX_PATTERN_SUGGESTIONS = 10;

// trim + lowercase + collapse internal whitespace, so "Anarkali", "anarkali" and " Anarkali  "
// all resolve to the same pattern
const normalize = (name) => name.trim().toLowerCase().replace(/\s+/g, " ");

class PatternRepository {
    async findById(runner, id) {
        const [result] = await runner.select().from(pattern).where(eq(pattern.id, id)).limit(1);

        return result;
    }

    async search(keyword) {
        return db
            .select({ id: pattern.id, name: pattern.name })
            .from(pattern)
            .where(ilike(pattern.name, `%${keyword}%`))
            .orderBy(pattern.name)
            .limit(MAX_PATTERN_SUGGESTIONS);
    }

    // Resolves a pattern by name, creating it if it doesn't exist yet. Race-safe: if two
    // requests resolve the same new name concurrently, the unique index on normalizedName
    // rejects the second insert (onConflictDoNothing) and it falls back to reading the row
    // the other request just committed — mirrors jobberRepository.findOrCreate.
    async findOrCreate(tx, name) {
        const normalizedName = normalize(name);

        const [inserted] = await tx
            .insert(pattern)
            .values({ name: name.trim(), normalizedName })
            .onConflictDoNothing()
            .returning();

        if (inserted) return inserted;

        const [existing] = await tx.select().from(pattern).where(eq(pattern.normalizedName, normalizedName)).limit(1);

        return existing;
    }
}

export default new PatternRepository();
