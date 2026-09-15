import { forwardRef } from "react";
import { useStepperItemContext } from "./hooks/useStepperItem";
import { CheckIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const StepperIndicator = forwardRef(({
    asChild = false,
    className,
    children,
    ...props
}, ref) => {
    const { state, step, isLoading } = useStepperItemContext();

    return (
        <div ref={ref}
            className={cn(
                "relative flex size-6 shrink-0 items-center justify-center rounded-full",
                "bg-muted text-xs font-medium text-muted-foreground",

                (state === "active" || state === "complete") && "bg-[#00694C] text-white",

                className
            )}
            data-state={state}
            {...props}
        >
            {asChild ? (
                children
            ) : (
                <>
                    {/* Step Number */}
                    <span
                        className={cn(
                            "transition-all",
                            (isLoading || state === "complete") && "scale-0 opacity-0"
                        )}
                    >
                        {step}
                    </span>

                    {/* Completed Icon */}
                    <CheckIcon
                        width={16}
                        height={16}
                        className={cn("absolute transition-all",
                            state === "complete" ? "scale-100 opacity-100" : "scale-0 opacity-0"
                        )}
                    />

                    {/* Loading Spinner */}
                    {isLoading && (
                        <span className="absolute">
                            <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                        </span>
                    )}
                </>
            )}
        </div >
    )
})

StepperIndicator.displayName = "StepperIndicator";
