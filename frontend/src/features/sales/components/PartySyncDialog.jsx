import ActionModal from "@/components/shared/ActionModal";
import { Button } from "@/components/ui/button";

const LABELS = {
    name: "Party name",
    mobile: "Mobile",
    city: "City",
    gst: "GST No.",
    transport: "Transport",
    agent: "Agent",
};

// Asks the question the prototype asks: the details typed on this document differ from the saved
// party, so does Party Master keep the change for future documents, or is it a one-off?
//
// It matters because both answers are legitimate and the app cannot guess. A customer who has
// genuinely moved city should update the master; goods going to a different address this once
// should not.
const PartySyncDialog = ({ changed, linkedParty, party, onChoose, onClose }) => (
    <ActionModal
        openActionModal
        setOpenActionModal={onClose}
        title="Update Party Master?"
        subtitle={`You changed ${changed.length} field${changed.length === 1 ? "" : "s"} for ${party.name}.`}
        showCloseButton
    >
        <div className="px-6 py-4">
            <div className="overflow-hidden rounded-xl border border-[#1E1B4B]/10">
                <div className="grid grid-cols-3 gap-3 bg-[#1E1B4B]/5 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[#1E1B4B]/50">
                    <span>Field</span>
                    <span>In Party Master</span>
                    <span>On this document</span>
                </div>

                {changed.map((field) => (
                    <div key={field} className="grid grid-cols-3 gap-3 border-t border-[#1E1B4B]/8 px-3 py-2 text-xs">
                        <span className="text-[#1E1B4B]/70">{LABELS[field]}</span>
                        <span className="text-[#1E1B4B]/40 line-through">{linkedParty[field] || "—"}</span>
                        <span className="font-semibold text-[#1E1B4B]">{party[field] || "—"}</span>
                    </div>
                ))}
            </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-white/40 px-6 py-4">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="outline" className="rounded-full" onClick={() => onChoose("document")}>
                Use for this document only
            </Button>
            <Button className="rounded-full bg-[#00694C] px-5 text-white hover:bg-[#00563e]" onClick={() => onChoose("master")}>
                Update Party Master
            </Button>
        </div>
    </ActionModal>
);

export default PartySyncDialog;
