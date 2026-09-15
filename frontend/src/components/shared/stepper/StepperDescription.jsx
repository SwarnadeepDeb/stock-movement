import { cn } from "@/lib/utils"
import { forwardRef } from "react"

export const StepperDescription = forwardRef(({ className, ...props }, ref) => {
    return (
        <p
            ref={ref}
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        />
    )
})

StepperDescription.displayName = "StepperDescription"
