import QuantityStepper from "../components/QuantityStepper";

// Same right-aligned numeric cell convention as LooseAvailabilityColumns/CurrentStockDetailColumns.
const numericCell = (value, emphasize) => (
  <span className={emphasize ? "block text-right font-semibold text-foreground tabular-nums" : "block text-right text-muted-foreground tabular-nums"}>
    {value}
  </span>
);

// "Bundle Qty" is the fixed recipe (pieces of this size per single bundle, from the selected
// bundle's composition — never edited here). "Create" is the one shared "how many bundles"
// stepper repeated per row (same lesson as LooseAvailabilityColumns' "Select to Use": the
// control must live where the user is looking, not in a disconnected control elsewhere) —
// editing any row's stepper moves bundlesToCreate for all of them together.
export const bundleColumns = [
  {
    accessorKey: "size",
    header: "Size",
    cell: ({ row }) => <span className="font-medium text-foreground">{row.original.size}</span>,
  },
  {
    accessorKey: "loosePieces",
    header: "Available",
    cell: ({ row }) => numericCell(row.original.loosePieces),
  },
  {
    accessorKey: "bundleQty",
    header: "Bundle Qty",
    cell: ({ row }) => numericCell(row.original.bundleQty),
  },
  {
    accessorKey: "bundlesToCreate",
    header: "Create",
    cell: ({ row }) => (
      <div className="flex justify-end">
        <QuantityStepper
          value={row.original.bundlesToCreate}
          onChange={row.original.onBundlesToCreateChange}
          min={0}
          max={row.original.maxBundles}
        />
      </div>
    ),
  },
  {
    accessorKey: "totalConsume",
    header: "Total Consume",
    cell: ({ row }) => numericCell(row.original.totalConsume, true),
  },
  {
    accessorKey: "remaining",
    header: "Remaining After",
    cell: ({ row }) => numericCell(row.original.remaining),
  },
];
