import { Badge } from "@/components/ui/badge";

export const columns = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "code", header: "Code" },
  {
    id: "variants",
    header: "Variants",
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        {(row.original.colorVariants ?? []).map((variant) => (
          <span
            key={variant.id}
            title={variant.colorName}
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: variant.colorHex }}
          />
        ))}
      </div>
    ),
  },
  {
    id: "setComposition",
    header: "Set Composition",
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-1">
        {(row.original.setComposition ?? []).map((size) => (
          <Badge key={size.id} variant="outline">
            {size.sizeLabel}
          </Badge>
        ))}
      </div>
    ),
  },
  { accessorKey: "itemName", header: "Item Name" },
  { accessorKey: "quality", header: "Quality" },
  // Historical field — no longer collected on Register Design, but existing designs still
  // carry real cost price data, so it stays visible here rather than being hidden.
  { accessorKey: "defaultCostPricePerPiece", header: "Cost Price" },
  { accessorKey: "defaultSellingPricePerPiece", header: "Selling Price" },
];
