import { DESIGN_STEPS } from "../steps/DesignSteps";

const StepRenderer = ({ activeStep, control, ...rest }) => {
    const CurrentStep = DESIGN_STEPS[activeStep].component;

    return (
        <CurrentStep control={control} {...rest} />
    )
}

export default StepRenderer
