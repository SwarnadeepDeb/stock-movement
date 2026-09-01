import { and, asc, count, eq, ilike, ne, or } from "drizzle-orm";

import { party } from "../schemas/party.schema.js";

// The single definition of how a party name is compared. Normalization lives here rather than in
// the service so no write path can reach the table without going through it.
export function normalizeName(name) {
    return String(name ?? "").trim().toLowerCase();
}

function buildFilters({ keyword, includeInactive }) {
    const conditions = [];

    if (!includeInactive) conditions.push(eq(party.isActive, true));

    if (keyword) {
        conditions.push(or(
            ilike(party.name, `%${keyword}%`),
            ilike(party.mobile, `%${keyword}%`),
            ilike(party.city, `%${keyword}%`),
            ilike(party.gst, `%${keyword}%`),
        ));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
}

// Every method takes a `runner` (either `db` or a transaction) as its first argument, matching
// the other repositories — that is what lets the service wrap a duplicate check and an insert in
// a single transaction.
class PartyRepository {
    async create(runner, data) {
        const name = String(data.name).trim();

        const [result] = await runner.insert(party).values({
            ...data,
            name,
            normalizedName: normalizeName(name),
        }).returning();

        return result;
    }

    async update(runner, id, data) {
        const patch = { ...data, updatedAt: new Date() };

        if (data.name !== undefined) {
            patch.name = String(data.name).trim();
            patch.normalizedName = normalizeName(patch.name);
        }

        const [result] = await runner.update(party).set(patch).where(eq(party.id, id)).returning();

        return result;
    }

    async setActive(runner, id, isActive) {
        const [result] = await runner.update(party)
            .set({ isActive, updatedAt: new Date() })
            .where(eq(party.id, id))
            .returning();

        return result;
    }

    async findById(runner, id) {
        const [result] = await runner.select().from(party).where(eq(party.id, id)).limit(1);

        return result;
    }

    // `excludeId` lets an update keep its own name without colliding with itself.
    async findByName(runner, name, excludeId) {
        const conditions = [eq(party.normalizedName, normalizeName(name))];
        if (excludeId) conditions.push(ne(party.id, excludeId));

        const [result] = await runner.select().from(party).where(and(...conditions)).limit(1);

        return result;
    }

    async findMany(runner, { limit, offset, keyword, includeInactive }) {
        return runner.select().from(party)
            .where(buildFilters({ keyword, includeInactive }))
            .orderBy(asc(party.name))
            .limit(limit)
            .offset(offset);
    }

    async count(runner, { keyword, includeInactive } = {}) {
        const [result] = await runner.select({ value: count() }).from(party)
            .where(buildFilters({ keyword, includeInactive }));

        return result.value;
    }
}

export default new PartyRepository();
