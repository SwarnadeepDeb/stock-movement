import { db } from "../../../database/index.js";
import tagPresetRepository from "../repositories/tagPreset.repository.js";

class TagPresetService {
    _tagPresetRepository = tagPresetRepository;

    async upsert(designId, data) {
        return db.transaction((tx) => this._tagPresetRepository.upsertByDesignId(tx, designId, data));
    }
}

export default new TagPresetService();
