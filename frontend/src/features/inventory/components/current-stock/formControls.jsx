import { cn } from "@/lib/utils";

// Small form primitives shared by the Current Stock dialogs/drawer — plain inputs styled like the
// rest of the inventory pages (slate borders, emerald focus), so dark mode flips with the palette.

export const FIELD_INPUT =
  "w-full rounded-[9px] border-[1.5px] border-slate-300 bg-white px-3 py-2 text-[13.6px] text-slate-900 outline-none focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15";

export const Field = ({ label, required, hint, className, children }) => (
  <div className={className}>
    <label className="mb-1.5 block text-[12.3px] font-semibold text-slate-700">
      {label}
      {required && <span className="text-red-600"> *</span>}
      {hint && <span className="ml-1 font-normal text-slate-400">{hint}</span>}
    </label>
    {children}
  </div>
);

export const OptionButton = ({ active, onClick, children, className }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      "rounded-[9px] border-[1.5px] px-3 py-2 text-[12.8px] font-semibold transition-colors",
      active ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
      className,
    )}
  >
    {children}
  </button>
);

export const NumberInput = ({ className, ...props }) => (
  <input
    type="number"
    inputMode="numeric"
    min={0}
    className={cn(FIELD_INPUT, "font-mono font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none", className)}
    {...props}
  />
);

export const Preview = ({ children }) => (
  <div className="mt-3 rounded-[10px] border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[12.8px] text-slate-700">{children}</div>
);

export const DialogFooter = ({ children }) => (
  <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3.5">{children}</div>
);
