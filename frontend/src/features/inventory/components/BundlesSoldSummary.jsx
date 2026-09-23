import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useModal } from "@/components/shared/ModalProvider";
import SellBundleDialog from "./SellBundleDialog";
import BundleSummary from "./BundleSummary";

// Same shape as Stock In's BundleList — a list of individually add/edit/removable entries,
// each rendered with the unmodified BundleSummary row. The only difference is what opens:
// SellBundleDialog picks from existing compositions instead of freely composing a new one.
const BundlesSoldSummary = ({ bundles, compositions, disabled, onAdd, onUpdate, onRemove }) => {
  const { openModal } = useModal();

  const openAddDialog = () => {
    openModal(SellBundleDialog, {
      compositions,
      initialBundle: null,
      isEditing: false,
      onSubmit: onAdd,
    });
  };

  const openEditDialog = (bundle) => {
    openModal(SellBundleDialog, {
      compositions,
      initialBundle: bundle,
      isEditing: true,
      onSubmit: (bundleData) => onUpdate(bundle.localId, bundleData),
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {bundles.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">Bundles</h3>
          {bundles.map((bundle, index) => (
            <BundleSummary
              key={bundle.localId}
              bundle={bundle}
              index={index}
              onEdit={() => openEditDialog(bundle)}
              onRemove={() => onRemove(bundle.localId)}
            />
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full justify-start gap-2 text-muted-foreground"
        onClick={openAddDialog}
        disabled={disabled}
      >
        <PlusIcon className="size-4" />
        Add Bundle
      </Button>
    </div>
  );
};

export default BundlesSoldSummary;
