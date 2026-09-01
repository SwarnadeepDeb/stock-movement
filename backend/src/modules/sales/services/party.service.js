import { db } from "../../../database/index.js";
import ApiError from "../../../core/apiError.js";

import partyRepository from "../repositories/party.repository.js";
import orderFormRepository from "../repositories/orderForm.repository.js";
import partyMapper from "../mapper/partyMapper.js";

const PARTY_FIELDS = ["name", "mobile", "city", "gst", "transport", "agent"];

// Turns "" into null: an empty text input means "not recorded", and storing "" would make
// "has no GST" and "GST is the empty string" two different states in the database.
function normalizePayload(payload) {
    const row = {};

    for (const field of PARTY_FIELDS) {
        if (payload[field] === undefined) continue;
        const value = String(payload[field]).trim();
        row[field] = field === "name" ? value : (value === "" ? null : value);
    }

    return row;
}

// Postgres raises 23505 on parties_normalized_name_unique_idx when two requests race past the
// service's own check. Both paths must report the same thing to the client.
function isUniqueViolation(error) {
    return error?.code === "23505" || error?.originalError?.code === "23505";
}

// Names the party that already exists rather than echoing what was typed, so "meera TEXTILES"
// is told it collides with "Meera Textiles" — which is the information needed to decide whether
// this is the same customer.
function duplicateError(name) {
    return new ApiError(`${name} already exists in Party Master.`, 409, "PARTY_NAME_EXISTS");
}

function notFoundError(id) {
    return new ApiError(`Party ${id} not found.`, 404, "PARTY_NOT_FOUND");
}

class PartyService {
    _partyRepository = partyRepository;
    _orderFormRepository = orderFormRepository;
    _partyMapper = partyMapper;

    async createParty(payload) {
        const row = normalizePayload(payload);

        try {
            // The check and the insert share one transaction, so two concurrent creates cannot
            // both see "no duplicate" and both proceed.
            const created = await db.transaction(async (tx) => {
                const existing = await this._partyRepository.findByName(tx, row.name);
                if (existing) throw duplicateError(existing.name);

                return this._partyRepository.create(tx, row);
            });

            return this._partyMapper.map(created);
        } catch (error) {
            if (isUniqueViolation(error)) throw duplicateError(row.name);
            throw error;
        }
    }

    async updateParty(id, payload) {
        const partyId = Number(id);
        const row = normalizePayload(payload);

        try {
            const updated = await db.transaction(async (tx) => {
                const existing = await this._partyRepository.findById(tx, partyId);
                if (!existing) throw notFoundError(partyId);

                if (row.name !== undefined) {
                    const clash = await this._partyRepository.findByName(tx, row.name, partyId);
                    if (clash) throw duplicateError(clash.name);
                }

                return this._partyRepository.update(tx, partyId, row);
            });

            return this._partyMapper.map(updated);
        } catch (error) {
            if (isUniqueViolation(error)) throw duplicateError(row.name);
            throw error;
        }
    }

    async setStatus(id, isActive) {
        const partyId = Number(id);

        const existing = await this._partyRepository.findById(db, partyId);
        if (!existing) throw notFoundError(partyId);

        const updated = await this._partyRepository.setActive(db, partyId, isActive);

        return this._partyMapper.map(updated);
    }

    async getParty(id) {
        const partyId = Number(id);

        const existing = await this._partyRepository.findById(db, partyId);
        if (!existing) throw notFoundError(partyId);

        return this._partyMapper.map(existing);
    }

    async listParties({ page = 1, limit = 50, q, includeInactive = false } = {}) {
        const offset = (page - 1) * limit;
        const filters = { keyword: q?.trim() || undefined, includeInactive };

        const [rows, total] = await Promise.all([
            this._partyRepository.findMany(db, { limit, offset, ...filters }),
            this._partyRepository.count(db, filters),
        ]);

        // The list shows how many order forms each party has.
        const counts = await this._orderFormRepository.countByPartyIds(db, rows.map((row) => row.id));
        const orderFormsByParty = new Map(counts.map((row) => [row.partyId, row.value]));

        return {
            data: this._partyMapper.mapMany(rows).map((entry) => ({ ...entry, orderForms: orderFormsByParty.get(entry.id) ?? 0 })),
            meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        };
    }

    // Backs the Stock Out overview tile.
    async countParties() {
        return this._partyRepository.count(db, {});
    }
}

export default new PartyService();
