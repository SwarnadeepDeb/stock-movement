import { EyeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useModal } from "@/components/shared/ModalProvider";
import StockHistoryDetailDialog from "./StockHistoryDetailDialog";

const StockHistoryRowActions = ({ item }) => {
  const { openModal } = useModal();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="View history details"
      title="View details"
      onClick={() => openModal(StockHistoryDetailDialog, { item })}
    >
      <EyeIcon />
    </Button>
  );
};

export default StockHistoryRowActions;
