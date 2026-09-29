import { useState } from "react";
import { FormProvider } from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";

import { useDesignForm } from "../hooks/useDesignForm";
import { useDesignWizard } from "../hooks/useDesignWizard";
import { useDesignRegisterApi } from "../hooks/useDesignRegisterApi";
import { useDesignUpdateApi } from "../hooks/useDesignDetailApi";
import { useCreateDesignDraftApi } from "../hooks/useDesignDraftsApi";
import DesignStepper from "./DesignStepper";
import StepRenderer from "./StepRenderer";
import DesignWizardNavigation from "./DesignWizardNavigation";
import { DESIGN_STEPS } from "../steps/DesignSteps";
import { sortSizes } from "../utils/sizeOrder";

// Register a new design, or — with `editDesign` (the GET /designs/:id payload) and matching
// `initialValues` — edit an existing one through the same three steps.
const DesignWizard = ({ editDesign = null, initialValues } = {}) => {
    const form = useDesignForm(initialValues);
    const navigate = useNavigate();
    const isEdit = Boolean(editDesign);

    const wizard = useDesignWizard(form);

    const { mutateAsync, isPending: isRegistering } = useDesignRegisterApi();
    const { mutateAsync: updateDesign, isPending: isUpdating } = useDesignUpdateApi();
    const isPending = isRegistering || isUpdating;
    const { mutateAsync: createDraft, isPending: isSavingDraft } = useCreateDesignDraftApi();

    // Populated by DesignIdentity (Step 1) once the typed Design Code matches an existing
    // design; consumed here (final duplicate gate) and by Variants (Step 3, to block adding a
    // colour that's already on that design) — see useExistingDesignByCode.
    const [existingDesignByCode, setExistingDesignByCode] = useState(null);

    const onSubmit = async (data) => {
        const { colorVariants = [], sizes = [], semiSets = [], ...designData } = data;

        // Caught here (on Save) rather than left to the backend's rejection, so the user gets
        // immediate feedback without a round trip — Next never reaches this, since it only
        // validates the current step's own fields.
        if (colorVariants.length === 0) {
            toast.error("At least one color variant is required.");
            return;
        }

        // displayOrder follows size order (S-M-L-XL), not the order sizes were clicked in.
        const designSizes = sortSizes(sizes).map((sizeLabel, index) => ({
            sizeLabel,
            displayOrder: index,
            includedInSet: true,
        }));

        // Blank labels or sizeless entries are left-behind form state, not real semi sets.
        const semiSetsPayload = semiSets
            .filter((semiSet) => semiSet.label?.trim() && semiSet.sizeLabels?.length > 0)
            .map((semiSet, index) => ({
                label: semiSet.label.trim(),
                displayOrder: index,
                sizeLabels: sortSizes(semiSet.sizeLabels),
            }));

        if (isEdit) {
            try {
                const response = await updateDesign({
                    id: editDesign.id,
                    ...designData,
                    colorVariants: colorVariants.map((variant) => ({
                        ...(variant.id ? { id: variant.id } : {}),
                        colorName: variant.colorName,
                        colorHex: variant.colorHex,
                        replaceImage: Boolean(variant.id && variant.imageFile),
                    })),
                    designSizes,
                    semiSets: semiSetsPayload,
                    // One file per new or re-photographed variant, in list order (see updateDesignApi).
                    images: colorVariants.filter((variant) => variant.imageFile).map((variant) => variant.imageFile),
                });
                const converted = response?.data?.changes?.convertedSets ?? [];
                toast.success("Design updated.");
                converted.forEach((item) =>
                    toast.info(`${item.colorName}: ${item.sets} existing complete set${item.sets === 1 ? "" : "s"} became semi sets (they don't include the new size).`),
                );
                navigate("/designs");
            } catch (error) {
                toast.error(error?.message ?? "Couldn't update design. Please try again.");
            }
            return;
        }

        // Last-resort client-side gate: if every submitted colour already exists on the matched
        // design, this submission has nothing new in it — the backend would reject it as a full
        // duplicate anyway, so avoid the round trip and image upload.
        if (existingDesignByCode) {
            const existingColorNames = new Set(
                (existingDesignByCode.colorVariants ?? []).map((variant) => variant.colorName.trim().toLowerCase())
            );
            const nothingNewSubmitted = colorVariants.length > 0 && colorVariants.every(
                (variant) => existingColorNames.has(variant.colorName.trim().toLowerCase())
            );

            if (nothingNewSubmitted) {
                toast.error("Design already exists in the database.");
                return;
            }
        }

        try {
            const response = await mutateAsync({
                ...designData,
                colorVariants: colorVariants.map(({ colorName, colorHex }) => ({ colorName, colorHex })),
                designSizes,
                semiSets: semiSetsPayload,
                images: colorVariants.map((variant) => variant.imageFile),
            });

            toast.success(response?.message ?? "Design registered successfully.");

            form.reset();
            wizard.setActiveStep(0);
            setExistingDesignByCode(null);
        } catch (error) {
            toast.error(error?.message ?? "Couldn't register design. Please try again.");
        }
    };

    // Saves the form as-is — no validation, a draft may be half-filled. A variant's photo (a
    // browser File + blob: preview URL) can't be stored as JSON, so it's left out of the draft
    // for now; the colour name/hex are kept.
    const handleSaveDraft = async () => {
        const { colorVariants = [], ...values } = form.getValues();
        const state = {
            ...values,
            colorVariants: colorVariants.map((variant) => {
                const storable = { ...variant };
                delete storable.imageFile;
                delete storable.imagePreview;
                return storable;
            }),
        };

        try {
            await createDraft({ currentStep: wizard.activeStep, state });
            toast.success("Draft saved.");
            navigate("/designs");
        } catch (error) {
            toast.error(error?.message ?? "Couldn't save draft. Please try again.");
        }
    };

    return (
        <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
                <DesignStepper activeStep={wizard.activeStep} setActiveStep={wizard.goTo} />

                <StepRenderer
                    activeStep={wizard.activeStep}
                    control={form.control}
                    existingDesignByCode={existingDesignByCode}
                    setExistingDesignByCode={setExistingDesignByCode}
                    editDesign={editDesign}
                />

                <DesignWizardNavigation
                    activeStep={wizard.activeStep}
                    totalSteps={DESIGN_STEPS.length}
                    isSubmitting={isPending}
                    onNext={wizard.next}
                    onPrev={wizard.prev}
                    onSaveDraft={isEdit ? undefined : handleSaveDraft}
                    isSavingDraft={isSavingDraft}
                />
            </form>
        </FormProvider>
    )
}

export default DesignWizard
