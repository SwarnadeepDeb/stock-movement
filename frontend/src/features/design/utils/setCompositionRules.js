// A design's set needs at least one size. Registered on the form up front (see useDesignWizard)
// as well as on the Set Composition Controller, so jumping straight from Design Identity to
// Variants via the stepper is still blocked even though Set Composition was never shown.
export const sizesRules = {
  validate: (value) => (value?.length ?? 0) > 0 || "Select at least one size for the set composition.",
};
