// Shared rules for name fields on Design Identity (Item Name, Jobber Name, Pattern Name,
// Quality) — kept in step with lettersOnlyField in backend design.validator.js: letters only
// (single spaces/hyphens between words, so "Co-ord Set" / "Up-Down" are allowed), max 50 chars.
export const NAME_MAX_LENGTH = 50;
export const LETTERS_PATTERN = /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/;

// Applied on every keystroke: drops anything that isn't a letter/space/hyphen, collapses
// repeated spaces and stops at the length limit. A trailing space/hyphen is kept so the user
// can keep typing the next word; validation rejects it if left at the end.
export const formatLettersOnly = (raw) =>
  raw
    .replace(/[^A-Za-z\s-]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s-]+/, "")
    .slice(0, NAME_MAX_LENGTH);

export const lettersOnlyRules = (label, { required = true } = {}) => ({
  validate: (value) => {
    const name = (value ?? "").trim();
    if (!name) return required ? `${label} is required.` : true;
    if (name.length > NAME_MAX_LENGTH) return `${label} must be at most ${NAME_MAX_LENGTH} characters.`;
    if (!LETTERS_PATTERN.test(name)) return `${label} can contain letters only (spaces and hyphens between words are allowed).`;
    return true;
  },
});
