import { db } from "../../../database/index.js";
import ApiError from "../../../core/apiError.js";

import stockInDraftRepository from "../repositories/stockInDraft.repository.js";

// List view of a draft — the design/variant identity is read from the wizard's own
// selectedVariants (the first one added drives the whole batch, same as the wizard's selling
// price), so the dashboard never has to understand the rest of `state`.
function toDraftSummary(row) {
    const variants = Array.isArray(row.state?.selectedVariants) ? row.state.selectedVariants : [];
    const primary = variants[0] ?? null;

    return {
        id: row.id,
        currentStep: row.currentStep,
        challanNo: row.challanNo,
        jobberName: row.jobberName,
        variantCount: variants.length,
        primaryVariant: primary
            ? {
                designCode: primary.designCode ?? null,
                designName: primary.designName ?? null,
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

function toDraftColumns({ currentStep, state }) {
    return {
        currentStep,
        state,
        challanNo: state?.challanNo?.trim() || null,
        jobberName: state?.jobber?.name?.trim() || null,
    };
}

class StockInDraftService {
    _stockInDraftRepository = stockInDraftRepository;

    async list() {
        const rows = await this._stockInDraftRepository.findAll(db);
        return rows.map(toDraftSummary);
    }

    async getById(id) {
        const row = await this._stockInDraftRepository.findById(db, id);
        if (!row) throw new ApiError("Stock In draft not found.", 404, "NOT_FOUND");
        return toDraftDetail(row);
    }

    async create(data) {
        const row = await this._stockInDraftRepository.create(db, toDraftColumns(data));
        return toDraftDetail(row);
    }

    async update(id, data) {
        const row = await this._stockInDraftRepository.update(db, id, toDraftColumns(data));
        if (!row) throw new ApiError("Stock In draft not found.", 404, "NOT_FOUND");
        return toDraftDetail(row);
    }

    async remove(id) {
        const row = await this._stockInDraftRepository.deleteById(db, id);
        if (!row) throw new ApiError("Stock In draft not found.", 404, "NOT_FOUND");
        return { id: row.id };
    }
}

export default new StockInDraftService();
