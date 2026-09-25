import QuantityStepper from "../components/QuantityStepper";

// Same right-aligned numeric cell convention as CurrentStockDetailColumns.
const numericCell = (value, emphasize) => (
  <span className={emphasize ? "block text-right font-semibold text-foreground tabular-nums" : "block text-right text-muted-foreground tabular-nums"}>
    {value}
  </span>
);

// "Select to Use" and "Remaining After" are derived columns: every required size consumes
// exactly `setsToCreate` pieces (§23 — one SET = one piece per size), so every row shares the
// same selectedToUse/remaining/maxSets/onSelectedToUseChange values — editing the stepper in
// any one row moves them all together, which is the whole point of the invariant.
export const columns = [
  {
    accessorKey: "size",
    header: "Size",
    cell: ({ row }) => <span className="font-medium text-foreground">{row.original.size}</span>,
  },
  {
    accessorKey: "loosePieces",
    header: "Available Pieces",
    cell: ({ row }) => numericCell(row.original.loosePieces),
  },
  {
    accessorKey: "selectedToUse",
    header: "Select to Use",
    cell: ({ row }) => (
      <div className="flex justify-end">
        <QuantityStepper
          value={row.original.selectedToUse}
          onChange={row.original.onSelectedToUseChange}
          min={0}
          max={row.original.maxSets}
        />
      </div>
    ),
  },
  {
    accessorKey: "remaining",
    header: "Remaining After",
    cell: ({ row }) => numericCell(row.original.remaining),
  },
];
