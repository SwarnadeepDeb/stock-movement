import { ChevronDown } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import SelectedVariantCard from "./SelectedVariantCard";
import VariantStockConfigPanel from "./VariantStockConfigPanel";

// One selected variant, rendered as a self-contained accordion item: identity stays
// visible in the header at all times, and its stock-entry sections only render while
// expanded — keeps every other variant's card collapsed and out of the way on mobile.
const VariantStockCard = ({
  variant,
  config,
  isExpanded,
  onToggle,
  onSetTotalSetsReceived,
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
        <VariantStockConfigPanel
          variant={variant}
          config={config}
          onSetTotalSetsReceived={onSetTotalSetsReceived}
          onAddBundle={onAddBundle}
          onUpdateBundle={onUpdateBundle}
          onRemoveBundle={onRemoveBundle}
          onSetLoosePieces={onSetLoosePieces}
        />
      </CollapsibleContent>
    </Collapsible>
  );
};

export default VariantStockCard;
