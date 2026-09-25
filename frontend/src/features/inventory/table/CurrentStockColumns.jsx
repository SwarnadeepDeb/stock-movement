import { Badge } from "@/components/ui/badge";
import CurrentStockRowActions from "../components/CurrentStockRowActions";
import CurrentStockVariantChip from "../components/CurrentStockVariantChip";

const STATUS_LABELS = {
  IN_STOCK: "In Stock",
  OUT_OF_STOCK: "Out of Stock",
};

const STATUS_BADGE_VARIANT = {
  IN_STOCK: "secondary",
  OUT_OF_STOCK: "destructive",
};

export const columns = [
  {
    id: "design",
    header: "Design",
    cell: ({ row }) => {
      const { designCode, designName, imageUrl } = row.original;

      return (
        <div className="flex min-w-0 items-center gap-3">
          <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
            {imageUrl && (
              <img src={imageUrl} alt={designName} className="h-full w-full object-cover" />
            )}
          </div>
          <span className="truncate text-sm font-medium text-foreground">
            {designCode ? `${designCode} · ` : ""}
            {designName}
          </span>
        </div>
      );
    },
  },
  {
    id: "variants",
    header: "Variants",
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-1.5">
        {(row.original.variants ?? []).map((variant) => (
          <CurrentStockVariantChip key={variant.colorVariantId} variant={variant} />
        ))}
      </div>
    ),
  },
  { accessorKey: "totalPieces", header: "Total Pieces" },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const { status } = row.original;

      return (
        <Badge variant={STATUS_BADGE_VARIANT[status] ?? "outline"}>
          {STATUS_LABELS[status] ?? status}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      // Any active variant works as the route's entry point — the detail page resolves the whole
      // design from it (see currentStock.service.js) — so the first is a stable, arbitrary-enough
      // pick backed by a real colorVariantId, never derived from display text.
      const colorVariantId = row.original.variants?.[0]?.colorVariantId;

      return colorVariantId ? <CurrentStockRowActions colorVariantId={colorVariantId} /> : null;
    },
  },
];
