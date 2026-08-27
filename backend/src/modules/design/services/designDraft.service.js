import { db } from "../../../database/index.js";

import designDraftRepository from "../repositories/designDraft.repository.js";

const DENORMALIZED_MAX_LENGTH = 255;

// A draft is never validated field by field, so anything copied out of `state` into a column
// is only trusted as far as "a non-blank string that fits".
function textOrNull(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, DENORMALIZED_MAX_LENGTH) : null;
}

// List view of a draft — the colour identity is read from the wizard's own colorVariants (the
// first one added), so the dashboard never has to understand the rest of `state`.
function toDraftSummary(row) {
    const variants = Array.isArray(row.state?.colorVariants) ? row.state.colorVariants : [];
    const primary = variants[0] ?? null;

    return {
        id: row.id,
        currentStep: row.currentStep,
        designCode: row.designCode,
        patternName: row.patternName,
        itemName: row.itemName,
        variantCount: variants.length,
        primaryVariant: primary
            ? {
                colorName: primary.colorName ?? null,
                colorHex: primary.colorHex ?? null,
            }
            : null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function toDraftDetail(row) {
    return { ...toDraftSummary(row), state: row.state };
}

// Field names follow the wizard's form (see DesignSteps.js): the pattern is typed into `name`.
function toDraftColumns({ currentStep, state }) {
    return {
        currentStep,
        state,
        designCode: textOrNull(state?.code),
        patternName: textOrNull(state?.name),
        itemName: textOrNull(state?.itemName),
    };
}

class DesignDraftService {
    _designDraftRepository = designDraftRepository;

    async create(data) {
        const row = await this._designDraftRepository.create(db, toDraftColumns(data));
        return toDraftDetail(row);
    }
}

export default new DesignDraftService();
