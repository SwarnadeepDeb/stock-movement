import { eq } from "drizzle-orm";

import { tagPreset } from "../schemas/tagPreset.schema.js";
import { design } from "../../design/schemas/design.schema.js";
import { printer } from "../schemas/printer.schema.js";

class TagPresetRepository {
    // QR Center reference/Library accordion: every preset with its design code and (nullable)
    // default printer name resolved, so the frontend never has to cross-reference printers
    // itself.
    async findAllWithContext(tx) {
        return tx.select({
            designId: tagPreset.designId,
            designCode: design.code,
            presetName: tagPreset.presetName,
            mediaSize: tagPreset.mediaSize,
            defaultPrinterName: printer.name,
        }).from(tagPreset)
            .innerJoin(design, eq(tagPreset.designId, design.id))
            .leftJoin(printer, eq(tagPreset.defaultPrinterId, printer.id));
    }

    // Tag Studio's "Save as preset" — one preset per design (see tag_presets.design_id
    // unique constraint), so a second save for the same design overwrites the first.
    async upsertByDesignId(tx, designId, { presetName, mediaSize, defaultPrinterId, config }) {
        const [result] = await tx.insert(tagPreset)
            .values({ designId, presetName, mediaSize, defaultPrinterId, config })
            .onConflictDoUpdate({
                target: tagPreset.designId,
                set: { presetName, mediaSize, defaultPrinterId, config },
            })
            .returning();
        return result;
    }
}

export default new TagPresetRepository();
