import { designDraft } from "../schemas/designDraft.schema.js";

class DesignDraftRepository {
    async create(tx, data) {
        const [result] = await tx.insert(designDraft).values(data).returning();
        return result;
    }
}

export default new DesignDraftRepository();
