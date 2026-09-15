import { forwardRef } from "react";
import { useStepperContext } from "./hooks/useStepper";
import { useStepperItemContext } from "./hooks/useStepperItem";
import { cn } from "@/lib/utils";

export const StepperTrigger = forwardRef(({
    asChild = false,
    className,
    children,
    onClick,
    ...props
}, ref) => {
    // needed for navigation
    const { setActiveStep } = useStepperContext();
    // need to know which step to activate
    const { step, isDisabled } = useStepperItemContext();

    const handleClick = (e) => {
        onClick?.(e)

        if (!e.defaultPrevented) {
            setActiveStep(step);
        }
    }

    if (asChild) {
        return (
            <div className={className}>
                {children}
            </div>
        );
    }

    return (
        <button
            ref={ref}
            type="button"
            className={cn(
                "inline-flex items-center gap-3",
                "disabled:pointer-events-none",
                "disabled:opacity-50",
                className
            )}
            disabled={isDisabled}
            onClick={handleClick}
            {...props}
        >
            {children}
        </button>
    )
})

StepperTrigger.displayName = "StepperTrigger";
