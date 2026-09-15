import { forwardRef, useMemo } from "react";
import { useStepperContext } from "./hooks/useStepper";
import { StepperItemContext } from "./contexts/StepItemContext";
import { cn } from "@/lib/utils";

// const getStepState = ({
//     step,
//     activeStep,
//     completed,
// }) => {
//     if (completed || step < activeStep) return "complete";

//     if (step === activeStep) return "active";

//     return "inactive";
// }

export const StepperItem = forwardRef(({
    step,
    completed = false,
    disabled = false,
    loading = false,
    className,
    children,
    ...props
}, ref) => {
    // consumer of stepper context
    const { activeStep, orientation } = useStepperContext();

    const state = useMemo(() => {
        if (completed || step < activeStep) return "complete";

        if (step === activeStep) return "active";

        return "inactive";
    }, [step, activeStep, completed]);

    const isLoading = loading && step === activeStep;

    const contextValue = useMemo(() => ({
        step,
        state,
        isDisabled: disabled,
        isLoading,
    }), [step, state, disabled, isLoading]);

    return (
        <StepperItemContext.Provider value={contextValue}>
            <div ref={ref}
                className={cn("group/step flex items-center", orientation === "horizontal" ? "flex-row" : "flex-col",
                    className
                )}
                data-state={state}
                data-loading={isLoading ? true : undefined}
                {...props}
            >{children}</div>
        </StepperItemContext.Provider>
    )
})

StepperItem.displayName = "StepperItem";
