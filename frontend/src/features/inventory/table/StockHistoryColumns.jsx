import { Badge } from "@/components/ui/badge";
import StockHistoryRowActions from "../components/stock-history/StockHistoryRowActions";
import { formatHistoryDateParts, getEventTypeBadgeVariant, getEventTypeLabel, getQuantityLabel } from "../utils/stockHistoryLabels";

export const stockHistoryColumns = [
  {
    id: "date",
    header: "Date",
    cell: ({ row }) => {
      const { date, time } = formatHistoryDateParts(row.original.createdAt);

      return (
        <div className="flex flex-col">
          <span className="text-sm text-foreground">{date}</span>
          <span className="text-xs text-muted-foreground">{time}</span>
        </div>
      );
    },
  },
  {
    id: "event",
    header: "Event",
    cell: ({ row }) => (
      <Badge variant={getEventTypeBadgeVariant(row.original.eventType)}>
        {getEventTypeLabel(row.original.eventType)}
      </Badge>
    ),
  },
  {
    id: "design",
    header: "Design",
    cell: ({ row }) => {
      const { designCode, designName } = row.original;

      return (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-foreground">{designCode}</span>
          <span className="truncate text-xs text-muted-foreground">{designName}</span>
        </div>
      );
    },
  },
  {
    id: "variant",
    header: "Variant",
    cell: ({ row }) => {
      const { colorName, colorHex } = row.original;

      return (
        <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
          <span
            className="size-2.5 shrink-0 rounded-full border border-black/10"
            style={{ backgroundColor: colorHex }}
          />
          {colorName}
        </span>
      );
    },
  },
  {
    id: "quantity",
    header: "Quantity",
    cell: ({ row }) => <span className="text-sm tabular-nums text-foreground">{getQuantityLabel(row.original)}</span>,
  },
  {
    id: "actions",
    header: "Action",
    cell: ({ row }) => <StockHistoryRowActions item={row.original} />,
  },
];
