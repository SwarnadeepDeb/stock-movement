import { Stepper, StepperDescription, StepperIndicator, StepperItem, StepperSeparator, StepperTitle, StepperTrigger } from "@/components/shared/stepper";
import { DESIGN_STEPS } from "../steps/DesignSteps";

const DesignStepper = ({
    activeStep,
    setActiveStep,
}) => {
    return (
        <Stepper value={activeStep} onValueChange={setActiveStep} orientation="horizontal" className="max-w-3xl py-4">
            {DESIGN_STEPS.map((step, index) => (
                <div key={step.id} className="flex items-start flex-1">
                    <StepperItem step={index}>
                        <StepperTrigger>
                            <StepperIndicator />

                            <div className="hidden md:flex md:flex-col">
                                <StepperTitle>
                                    {step.title}
                                </StepperTitle>

                                {step.description && (
                                    <StepperDescription>
                                        {step.description}
                                    </StepperDescription>
                                )}
                            </div>
                        </StepperTrigger>
                    </StepperItem>

                    {index < DESIGN_STEPS.length - 1 && (<StepperSeparator />)}
                </div>
            ))}
        </Stepper>
    )
}

export default DesignStepper;
