import { useContext } from "react";
import { StepperItemContext } from "../contexts/StepItemContext";

export const useStepperItemContext = () => {
    const context = useContext(StepperItemContext);

    if (!context) {
        throw new Error("useStepperItemContext must be used within a StepperItem");
    }

    return context;
};
