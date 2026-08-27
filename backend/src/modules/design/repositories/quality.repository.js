import { eq, ilike } from "drizzle-orm";

import { db } from "../../../database/index.js";
import { quality } from "../schemas/quality.schema.js";

// keep suggestion lists small — this backs an autocomplete dropdown, not a data table
const MAX_QUALITY_SUGGESTIONS = 10;

// trim + lowercase + collapse internal whitespace, so "Cotton", "cotton" and " Cotton  " all
// resolve to the same quality
const normalize = (name) => name.trim().toLowerCase().replace(/\s+/g, " ");

class QualityRepository {
    async findById(runner, id) {
        const [result] = await runner.select().from(quality).where(eq(quality.id, id)).limit(1);

        return result;
    }

    async search(keyword) {
        return db
            .select({ id: quality.id, name: quality.name })
            .from(quality)
            .where(ilike(quality.name, `%${keyword}%`))
            .orderBy(quality.name)
            .limit(MAX_QUALITY_SUGGESTIONS);
    }

    // Resolves a quality by name, creating it if it doesn't exist yet. Race-safe: if two
    // requests resolve the same new name concurrently, the unique index on normalizedName
    // rejects the second insert (onConflictDoNothing) and it falls back to reading the row
    // the other request just committed — mirrors jobberRepository.findOrCreate.
    async findOrCreate(tx, name) {
        const normalizedName = normalize(name);

        const [inserted] = await tx
            .insert(quality)
            .values({ name: name.trim(), normalizedName })
            .onConflictDoNothing()
            .returning();

        if (inserted) return inserted;

        const [existing] = await tx.select().from(quality).where(eq(quality.normalizedName, normalizedName)).limit(1);

        return existing;
    }
}

export default new QualityRepository();
