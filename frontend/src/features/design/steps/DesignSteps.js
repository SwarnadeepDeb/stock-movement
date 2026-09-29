import DesignIdentity from "./DesignIdentity";
import SetComposition from "./SetComposition";
import Variants from "./Variants";

export const DESIGN_STEPS = [
    {
        id: "design-identity",
        title: "Design Identity",
        fields: ["itemName", "code", "jobberName", "name", "quality"],
        component: DesignIdentity,
    },
    {
        id: "set-composition",
        title: "Set Composition",
        fields: ["sizes"],
        component: SetComposition,
    },
    {
        id: "variants",
        title: "Variants",
        fields: [],
        component: Variants,
    },
];
