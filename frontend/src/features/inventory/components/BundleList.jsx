import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useModal } from "@/components/shared/ModalProvider";
import AddBundleDialog from "./AddBundleDialog";
import BundleSummary from "./BundleSummary";

// Opens AddBundleDialog through the shared ModalProvider (same mechanism as VariantModal
// in the design feature) — the dialog itself is mounted/unmounted by the provider, so a
// fresh instance (and fresh form state) is guaranteed on every open.
const BundleList = ({ bundles, sizes, disabled, onAdd, onUpdate, onRemove }) => {
  const { openModal } = useModal();

  const openAddDialog = () => {
    openModal(AddBundleDialog, {
      sizes,
      initialBundle: null,
      isEditing: false,
      onSubmit: onAdd,
    });
  };

  const openEditDialog = (bundle) => {
    openModal(AddBundleDialog, {
      sizes,
      initialBundle: bundle,
      isEditing: true,
      onSubmit: (bundleData) => onUpdate(bundle.localId, bundleData),
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {bundles.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">Partial Bundles</h3>
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

export default BundleList;
