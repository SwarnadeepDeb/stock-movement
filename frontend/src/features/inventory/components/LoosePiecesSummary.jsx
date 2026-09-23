import { PlusIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useModal } from "@/components/shared/ModalProvider";
import AddLoosePiecesDialog from "./AddLoosePiecesDialog";
import { getLoosePiecesTotal } from "../utils/stockCalculations";

// Opens AddLoosePiecesDialog through the shared ModalProvider (same mechanism as
// VariantModal in the design feature). There's only ever one loose-pieces record per
// variant, so both the summary row and the "+ Add" action open the same editor.
const LoosePiecesSummary = ({ loosePieces, sizes, disabled, onChange }) => {
  const { openModal } = useModal();

  const total = getLoosePiecesTotal(loosePieces);
  const hasLoosePieces = total > 0;

  const openDialog = () => {
    openModal(AddLoosePiecesDialog, {
      sizes,
      initialLoosePieces: loosePieces,
      isEditing: hasLoosePieces,
      onSubmit: onChange,
    });
  };

  const handleClear = () => onChange({});

  return (
    <div className="flex flex-col gap-2">
      {hasLoosePieces && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-2.5">
          <button
            type="button"
            onClick={openDialog}
            className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left active:opacity-70"
          >
            <span className="text-sm font-medium text-foreground">Loose Pieces</span>
            <span className="text-xs text-muted-foreground">
              {total} loose piece{total === 1 ? "" : "s"}
            </span>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground"
            onClick={handleClear}
            aria-label="Clear loose pieces"
          >
            <XIcon />
          </Button>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full justify-start gap-2 text-muted-foreground"
        onClick={openDialog}
        disabled={disabled}
      >
        <PlusIcon className="size-4" />
        Add Loose Pieces
      </Button>
    </div>
  );
};

export default LoosePiecesSummary;
