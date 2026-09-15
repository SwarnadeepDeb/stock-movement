import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export const StepperTitle = forwardRef(({ className, ...props }, ref) => {
    return (
        <h3
            ref={ref}
            className={cn("text-sm font-medium", className)}
            {...props}
        />
    )
})

StepperTitle.displayName = "StepperTitle";
