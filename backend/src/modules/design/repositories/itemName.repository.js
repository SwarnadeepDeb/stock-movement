import { asc, eq } from "drizzle-orm";

import { db } from "../../../database/index.js";
import { itemName } from "../schemas/itemName.schema.js";

// trim + lowercase + collapse internal whitespace, so "Tunic", "tunic" and " Tunic  " all
// resolve to the same item name
const normalize = (name) => name.trim().toLowerCase().replace(/\s+/g, " ");

class ItemNameRepository {
    async findById(runner, id) {
        const [result] = await runner.select().from(itemName).where(eq(itemName.id, id)).limit(1);

        return result;
    }

    // The whole list, not a keyword search — it's a short, curated dropdown. Ordered by id so
    // the seeded defaults come first (in their seeded order), then names added later.
    async findAll() {
        return db
            .select({ id: itemName.id, name: itemName.name })
            .from(itemName)
            .orderBy(asc(itemName.id));
    }

    // Resolves an item name by name, creating it if it doesn't exist yet. Race-safe — mirrors
    // qualityRepository.findOrCreate. Names are always stored in capitals (the validator already
    // upper-cases them; repeated here so no other caller can insert mixed case).
    async findOrCreate(tx, name) {
        const normalizedName = normalize(name);
        const storedName = name.trim().replace(/\s+/g, " ").toUpperCase();

        const [inserted] = await tx
            .insert(itemName)
            .values({ name: storedName, normalizedName })
            .onConflictDoNothing()
            .returning();

        if (inserted) return inserted;

        const [existing] = await tx.select().from(itemName).where(eq(itemName.normalizedName, normalizedName)).limit(1);

        return existing;
    }
}

export default new ItemNameRepository();
