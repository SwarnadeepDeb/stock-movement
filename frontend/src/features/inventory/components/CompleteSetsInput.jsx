import { Input } from "@/components/ui/input";

// Shared by Stock In ("Sets received") and Stock Out ("Sets Out") — same plain, uncapped
// number entry either way; Stock Out relies on the backend's insufficient-stock rejection
// rather than a client-side max, same as every other field on that form.
const CompleteSetsInput = ({ value, onChange, label = "Sets received", id = "total-sets-received" }) => {
  const handleChange = (event) => {
    const rawValue = event.target.value;
    if (rawValue === "") {
      onChange(0);
      return;
    }
    const parsed = parseInt(rawValue, 10);
    onChange(Number.isNaN(parsed) || parsed < 0 ? 0 : parsed);
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        value={value || ""}
        onChange={handleChange}
        className="h-11 w-20 text-center text-base"
      />
    </div>
  );
};

export default CompleteSetsInput;
