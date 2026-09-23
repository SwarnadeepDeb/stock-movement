import { ChevronDown } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import SelectedVariantCard from "./SelectedVariantCard";
import VariantStockOutConfigPanel from "./VariantStockOutConfigPanel";

// Same accordion shell as Stock In's VariantStockCard — identity stays visible in the header,
// stock-entry sections only render while expanded.
const VariantStockOutCard = ({
  variant,
  config,
  isExpanded,
  onToggle,
  onSetTotalSetsSold,
  onAddBundle,
  onUpdateBundle,
  onRemoveBundle,
  onSetLoosePieces,
}) => {
  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={onToggle}
      className={cn(
        "overflow-hidden rounded-2xl border glass-card transition-colors",
        isExpanded ? "border-primary/50" : "border-border"
      )}
    >
      <CollapsibleTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-2 p-2.5 text-left active:bg-muted/40"
          />
        }
      >
        <SelectedVariantCard variant={variant} />
        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-muted-foreground transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <VariantStockOutConfigPanel
          variant={variant}
          config={config}
          onSetTotalSetsSold={onSetTotalSetsSold}
          onAddBundle={onAddBundle}
          onUpdateBundle={onUpdateBundle}
          onRemoveBundle={onRemoveBundle}
          onSetLoosePieces={onSetLoosePieces}
        />
      </CollapsibleContent>
    </Collapsible>
  );
};

export default VariantStockOutCard;
