import { forwardRef, useCallback, useState } from "react"
import { StepperContext } from "./contexts/StepperContext";
import { cn } from "@/lib/utils";

export const Stepper = forwardRef(({
    defaultValue = 0,
    value,
    onValueChange,
    orientation = "horizontal",
    className,
    children,
    ...props
}, ref) => {
    const [internalStep, setInternalStep] = useState(defaultValue);

    const currentStep = value ?? internalStep;

    const setActiveStep = useCallback((step) => {
        if (value === undefined) {
            setInternalStep(step);
        }

        onValueChange?.(step);
    }, [value, onValueChange]);

    return (
        <StepperContext.Provider value={{
            activeStep: currentStep,
            setActiveStep,
            orientation,
        }}>
            <div
                ref={ref}
                className={cn("group/stepper inline-flex", orientation === "horizontal" ? "w-full flex-row" : "flex-col", className)}
                data-orientation={orientation}
                {...props}
            >
                {children}
            </div>
        </StepperContext.Provider>
    )
})

Stepper.displayName = "Stepper";
