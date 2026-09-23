import { Input } from "@/components/ui/input";

// Per-size quantity entry, shared by the bundle-composition and loose-pieces dialogs.
// Only ever shows the active sizes passed in — never assumes a fixed size set.
// `readOnly` renders the same boxes disabled instead of editable — Stock Out's bundle dialog
// uses this to display an existing composition's fixed recipe (you can't invent one on sale,
// only pick how many of an already-assembled bundle to sell).
const SizeQuantityGrid = ({ sizes, values, onChange, readOnly = false }) => {
  const handleChange = (sizeId, rawValue) => {
    if (rawValue === "") {
      onChange(sizeId, 0);
      return;
    }
    const parsed = parseInt(rawValue, 10);
    onChange(sizeId, Number.isNaN(parsed) || parsed < 0 ? 0 : parsed);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {sizes.map((size) => (
        <div key={size.id} className="flex min-w-16 flex-1 flex-col items-center gap-1.5">
          <label htmlFor={`size-qty-${size.id}`} className="text-xs font-medium text-muted-foreground">
            {size.sizeLabel}
          </label>
          <Input
            id={`size-qty-${size.id}`}
            type="number"
            inputMode="numeric"
            min={0}
            value={values[size.id] || ""}
            onChange={readOnly ? undefined : (event) => handleChange(size.id, event.target.value)}
            disabled={readOnly}
            className="h-11 w-full text-center text-base"
          />
        </div>
      ))}
    </div>
  );
};

export default SizeQuantityGrid;
