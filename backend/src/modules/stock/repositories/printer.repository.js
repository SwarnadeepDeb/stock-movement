import { eq } from "drizzle-orm";

import { printer } from "../schemas/printer.schema.js";

class PrinterRepository {
    async findAllActive(tx) {
        return tx.select().from(printer).where(eq(printer.isActive, true));
    }

    async findById(tx, id) {
        const [result] = await tx.select().from(printer).where(eq(printer.id, id)).limit(1);
        return result;
    }
}

export default new PrinterRepository();
