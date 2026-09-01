import ApiError from "../../../core/apiError.js";

import partyRepository from "../repositories/party.repository.js";

const PARTY_FIELDS = ["name", "mobile", "city", "gst", "transport", "agent"];

// Decides what a saved document does to Party Master.
//
// The client has already had the conversation with the user — the prototype's "Update Party
// Master?" dialogue — and tells us the outcome through `partySync`:
//
//   "document"  keep the typed details on this document only, leave Party Master alone
//   "master"    also write them back to the party record, for future documents
//
// Either way the document gets a frozen snapshot of what was typed. A party with a name that is
// not in Party Master yet is always created, because a document must never reference a customer
// who does not exist in the master list.
class PartyResolverService {
    _partyRepository = partyRepository;

    async resolve(tx, payload) {
        const snapshot = PARTY_FIELDS.reduce((party, field) => {
            party[field] = String(payload.party?.[field] ?? "").trim();
            return party;
        }, {});

        if (!snapshot.name) {
            throw new ApiError("Party name is required.", 400, "PARTY_NAME_REQUIRED");
        }

        // A party id from the client is a hint, not a fact — it may name a party that has since
        // been deleted, or one whose name no longer matches what was typed.
        let party = payload.partyId ? await this._partyRepository.findById(tx, Number(payload.partyId)) : undefined;

        if (!party || party.normalizedName !== snapshot.name.trim().toLowerCase()) {
            party = await this._partyRepository.findByName(tx, snapshot.name);
        }

        if (!party) {
            const created = await this._partyRepository.create(tx, snapshot);
            return { partyId: created.id, snapshot, createdParty: true };
        }

        if (payload.partySync === "master") {
            await this._partyRepository.update(tx, party.id, snapshot);
        }

        return { partyId: party.id, snapshot, createdParty: false };
    }
}

export default new PartyResolverService();
