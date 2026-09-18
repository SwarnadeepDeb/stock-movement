let fallbackCounter = 0;

// UI-only key for React list rendering — the backend assigns the real bundle number.
export const createLocalId = (prefix = "bundle") =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${fallbackCounter++}`;
