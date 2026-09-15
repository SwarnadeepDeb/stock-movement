import { useContext } from "react";
import { StepperContext } from "../contexts/StepperContext";

export const useStepperContext = () => {
    const context = useContext(StepperContext);

    if (!context) {
        throw new Error("useStepperContext must be used within a Stepper");
    }

    return context;
};
