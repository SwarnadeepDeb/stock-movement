import { forwardRef } from "react"
import { useStepperContext } from "./hooks/useStepper"
import { cn } from "@/lib/utils";

export const StepperSeparator = forwardRef(({ className, ...props }, ref) => {
    const { orientation } = useStepperContext();

    return (
        <div
            ref={ref}
            className={cn(
                "m-0.5 bg-muted",

                orientation === "horizontal" ? "h-0.5 w-full flex-1" : "h-12 w-0.5",

                className
            )}
            {...props}
        />
    )
})

StepperSeparator.displayName = "StepperSeparator"
