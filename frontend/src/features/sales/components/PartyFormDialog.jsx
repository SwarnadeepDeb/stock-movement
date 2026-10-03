import { useState } from "react";
import { toast } from "react-toastify";
import ActionModal from "@/components/shared/ActionModal";
import { Button } from "@/components/ui/button";
import { useCreatePartyApi, useUpdatePartyApi } from "../hooks/usePartyMutations.js";

const FIELDS = [
    { key: "name", label: "Party name", required: true, span: true },
    { key: "mobile", label: "Mobile" },
    { key: "city", label: "City" },
    { key: "gst", label: "GST No." },
    { key: "transport", label: "Transport" },
    { key: "agent", label: "Agent" },
];

const EMPTY = { name: "", mobile: "", city: "", gst: "", transport: "", agent: "" };

const PartyFormDialog = ({ open, setOpen, party }) => {
    const [form, setForm] = useState(party ? { ...EMPTY, ...party } : EMPTY);
    const [nameError, setNameError] = useState("");

    const createParty = useCreatePartyApi();
    const updateParty = useUpdatePartyApi();
    const isSaving = createParty.isPending || updateParty.isPending;

    const setField = (key) => (event) => {
        setForm((previous) => ({ ...previous, [key]: event.target.value }));
        if (key === "name") setNameError("");
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            setNameError("Party name is required.");
            return;
        }

        const payload = FIELDS.reduce((accumulator, field) => {
            accumulator[field.key] = form[field.key]?.trim() ?? "";
            return accumulator;
        }, {});

        try {
            if (party) await updateParty.mutateAsync({ id: party.id, payload });
            else await createParty.mutateAsync(payload);

            toast.success(party ? "Party updated." : `${payload.name} added to Party Master.`);
            setOpen(false);
        } catch (error) {
            // A duplicate name is the one error the user can fix in place, so it belongs on the
            // field rather than in a toast that disappears.
            if (error.code === "PARTY_NAME_EXISTS") setNameError(error.message);
            else toast.error(error.message);
        }
    };

    return (
        <ActionModal
            openActionModal={open}
            setOpenActionModal={setOpen}
            title={party ? "Edit party" : "Add party"}
            subtitle=""
            showCloseButton
        >
            <div className="grid grid-cols-1 gap-4 px-6 py-4 sm:grid-cols-2">
                {FIELDS.map((field) => (
                    <div key={field.key} className={field.span ? "sm:col-span-2" : ""}>
                        <label className="mb-1.5 block text-xs font-semibold text-[#1E1B4B]" htmlFor={`party-${field.key}`}>
                            {field.label}
                            {field.required && <span className="text-red-600"> *</span>}
                        </label>
                        <input
                            id={`party-${field.key}`}
                            className="pill-input"
                            value={form[field.key] ?? ""}
                            onChange={setField(field.key)}
                            autoComplete="off"
                        />
                        {field.key === "name" && nameError && (
                            <p className="mt-1.5 text-xs font-medium text-red-600">{nameError}</p>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex justify-end gap-2 border-t border-white/40 px-6 py-4">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={isSaving}>Cancel</Button>
                <Button
                    className="rounded-full bg-[#00694C] px-5 text-white hover:bg-[#00563e]"
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {party ? "Save party" : "Add party"}
                </Button>
            </div>
        </ActionModal>
    );
};

export default PartyFormDialog;
