// Right-aligns numeric text inside DataTable's own cell padding — DataTable doesn't expose
// per-column alignment, so alignment is controlled at the content level instead. The header for
// each numeric column mirrors the same "block text-right" treatment so it lines up with its values
// (TableHead defaults to text-left — see components/ui/table.jsx).
const numericCell = (value, emphasize) => (
  <span className={emphasize ? "block text-right font-semibold text-foreground tabular-nums" : "block text-right text-muted-foreground tabular-nums"}>
    {value}
  </span>
);

const numericHeader = (label) => <span className="block text-right">{label}</span>;

export const columns = [
  {
    accessorKey: "size",
    header: "Size",
    cell: ({ row }) => <span className="font-medium text-foreground">{row.original.size}</span>,
  },
  {
    accessorKey: "setPieces",
    header: () => numericHeader("Set"),
    cell: ({ row }) => numericCell(row.original.setPieces),
  },
  {
    accessorKey: "bundlePieces",
    header: () => numericHeader("Bundle"),
    cell: ({ row }) => numericCell(row.original.bundlePieces),
  },
  {
    accessorKey: "loosePieces",
    header: () => numericHeader("Loose"),
    cell: ({ row }) => numericCell(row.original.loosePieces),
  },
  {
    id: "totalPieces",
    header: () => numericHeader("Total"),
    cell: ({ row }) => numericCell(row.original.totalPieces, true),
  },
];
