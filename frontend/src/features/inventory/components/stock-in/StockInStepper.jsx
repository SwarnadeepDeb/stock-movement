import { Stepper, StepperIndicator, StepperItem, StepperSeparator, StepperTitle, StepperTrigger } from "@/components/shared/stepper";
import { STOCK_IN_STEPS } from "../../hooks/useStockInWizard";

const StockInStepper = ({ activeStep, setActiveStep }) => {
  return (
    <Stepper value={activeStep} onValueChange={setActiveStep} orientation="horizontal" className="w-full">
      {STOCK_IN_STEPS.map((step, index) => (
        <div key={step.id} className="flex items-start flex-1">
          <StepperItem step={index}>
            <StepperTrigger className="gap-2">
              <StepperIndicator />

              <StepperTitle className="hidden text-xs font-semibold text-slate-500 group-data-[state=active]/step:text-slate-900 group-data-[state=complete]/step:text-slate-900 sm:block">
                {step.title}
              </StepperTitle>
            </StepperTrigger>
          </StepperItem>

          {index < STOCK_IN_STEPS.length - 1 && <StepperSeparator />}
        </div>
      ))}
    </Stepper>
  );
};

export default StockInStepper;
