import { formatLettersOnly, lettersOnlyRules } from "./nameRules";

// Item Name follows the shared letters-only rules (see nameRules.js) and is stored in capitals.
export const formatItemName = (raw) => formatLettersOnly(raw).toUpperCase();

export const itemNameRules = lettersOnlyRules("Item Name");
