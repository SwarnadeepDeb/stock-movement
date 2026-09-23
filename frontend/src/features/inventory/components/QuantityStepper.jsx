import { MinusIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Large-touch-target [-] value [+] control, used for bundle-quantity entry on mobile.
// `max` is optional (defaults to unbounded) — Stock In's freely-composed bundles never cap it,
// but Stock Out's "how many of this existing composition to sell" does.
const QuantityStepper = ({ value, onChange, min = 0, max = Infinity, id }) => {
  const clamp = (next) => Math.min(max, Math.max(min, Number.isFinite(next) ? next : min));

  const handleInputChange = (event) => {
    const rawValue = event.target.value;
    if (rawValue === "") {
      onChange(min);
      return;
    }
    const parsed = parseInt(rawValue, 10);
    onChange(Number.isNaN(parsed) ? min : clamp(parsed));
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-11 w-11 shrink-0"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        aria-label="Decrease"
      >
        <MinusIcon />
      </Button>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={Number.isFinite(max) ? max : undefined}
        value={value || ""}
        onChange={handleInputChange}
        className="h-11 w-16 text-center text-base"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-11 w-11 shrink-0"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label="Increase"
      >
        <PlusIcon />
      </Button>
    </div>
  );
};

export default QuantityStepper;
