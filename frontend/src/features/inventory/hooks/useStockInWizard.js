import { useState } from "react";

export const STOCK_IN_STEPS = [
  { id: "inward-details", title: "Inward Details" },
  { id: "set-matrix", title: "Set Matrix" },
  { id: "qc-defect", title: "QC & Defect" },
  { id: "qr-tag-studio", title: "QR Tag Studio" },
  { id: "summary", title: "Summary" },
];

// Plain step-index state (no react-hook-form here — the stock-in wizard's fields live in
// several independent hooks already, e.g. useVariantStockConfigs, so a single RHF form
// object would just duplicate that state). `canAdvance` is supplied by the page per-step so
// each step controls its own "is this ready to move on" rule.
export function useStockInWizard(canAdvance) {
  const [activeStep, setActiveStep] = useState(0);

  // Returns the step index it advanced to, or null when it didn't move — lets the page react
  // to a successful advance (e.g. autosaving the draft at the new step).
  const next = () => {
    if (canAdvance && !canAdvance(activeStep)) return null;
    if (activeStep >= STOCK_IN_STEPS.length - 1) return null;
    const nextStep = activeStep + 1;
    setActiveStep(nextStep);
    return nextStep;
  };

  const prev = () => {
    if (activeStep > 0) setActiveStep((prev) => prev - 1);
  };

  const goToStep = (index) => {
    if (index < 0 || index >= STOCK_IN_STEPS.length) return;
    setActiveStep(index);
  };

  return { activeStep, setActiveStep: goToStep, next, prev };
}
