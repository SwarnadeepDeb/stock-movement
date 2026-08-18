import { variantStatusTransaction } from "../schemas/variantStatusTransaction.schema.js";

class VariantStatusTransactionRepository {
    async create(tx, data) {
        const [result] = await tx
            .insert(variantStatusTransaction)
            .values(data)
            .returning();

        return result;
    }
}

export default new VariantStatusTransactionRepository();
