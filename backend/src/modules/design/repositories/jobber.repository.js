import { eq, ilike } from "drizzle-orm";

import { db } from "../../../database/index.js";
import { jobber } from "../schemas/jobber.schema.js";

// keep suggestion lists small — this backs an autocomplete dropdown, not a data table
const MAX_JOBBER_SUGGESTIONS = 10;

// trim + lowercase + collapse internal whitespace, so "ABC Textiles", "abc textiles" and
// " ABC   Textiles " all resolve to the same jobber
const normalize = (name) => name.trim().toLowerCase().replace(/\s+/g, " ");

class JobberRepository {
    async findById(runner, id) {
        const [result] = await runner.select().from(jobber).where(eq(jobber.id, id)).limit(1);

        return result;
    }

    async search(keyword) {
        return db
            .select({ id: jobber.id, name: jobber.name })
            .from(jobber)
            .where(ilike(jobber.name, `%${keyword}%`))
            .orderBy(jobber.name)
            .limit(MAX_JOBBER_SUGGESTIONS);
    }

    // Resolves a jobber by name, creating it if it doesn't exist yet. Race-safe: if two
    // requests resolve the same new name concurrently, the unique index on normalizedName
    // rejects the second insert (onConflictDoNothing) and it falls back to reading the row
    // the other request just committed — mirrors stockGroupRepository.findOrCreate.
    async findOrCreate(tx, name) {
        const normalizedName = normalize(name);

        const [inserted] = await tx
            .insert(jobber)
            .values({ name: name.trim(), normalizedName })
            .onConflictDoNothing()
            .returning();

        if (inserted) return inserted;

        const [existing] = await tx.select().from(jobber).where(eq(jobber.normalizedName, normalizedName)).limit(1);

        return existing;
    }
}

export default new JobberRepository();
