import { EyeIcon } from "lucide-react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";

// Navigates to the Current Stock Detail page for this design. A design row now represents every
// variant combined, so the selector there should default to Total (?scope=total) — but the detail
// route's own contract is still a colorVariantId (see currentStock.route.js), so the design's
// first active variant is passed as the entry point; the detail page resolves the whole design
// from it and, given ?scope=total, opens with Total selected rather than that one variant.
const CurrentStockRowActions = ({ colorVariantId }) => {
  const navigate = useNavigate();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="View current stock"
      title="View current stock"
      onClick={() => navigate(`/current-stock/${colorVariantId}?scope=total`)}
    >
      <EyeIcon />
    </Button>
  );
};

export default CurrentStockRowActions;
