import { useEffect, useState } from "react";
import { DESIGN_STEPS } from "../steps/DesignSteps";
import { sizesRules } from "../utils/setCompositionRules";

export const useDesignWizard = (form) => {
    const [activeStep, setActiveStep] = useState(0);

    // Set Composition's rule must exist before that step is ever shown — see setCompositionRules.
    useEffect(() => {
        form.register("sizes", sizesRules);
    }, [form]);

    const next = async () => {
        const fields = DESIGN_STEPS[activeStep].fields;

        const isValid = await form.trigger(fields);

        if (isValid && activeStep < DESIGN_STEPS.length - 1) {
            setActiveStep(prev => prev + 1);
        }
    };

    // Jumping via the stepper header: moving back is always allowed, but moving forward has to
    // pass every step in between (same check as Next) — otherwise clicking "Set Composition" or
    // "Variants" would skip Design Identity's required fields (e.g. Design Code).
    const goTo = async (targetStep) => {
        if (targetStep <= activeStep) {
            setActiveStep(targetStep);
            return;
        }

        for (let step = activeStep; step < targetStep; step++) {
            const isValid = await form.trigger(DESIGN_STEPS[step].fields);

            if (!isValid) {
                // Land on the first step that failed so its error messages are visible.
                setActiveStep(step);
                return;
            }
        }

        setActiveStep(targetStep);
    };

    const prev = () => {
        if (activeStep > 0) {
            setActiveStep(prev => prev - 1);
        }
    };

    return {
        activeStep,
        setActiveStep,
        goTo,
        next,
        prev,
    };
}
