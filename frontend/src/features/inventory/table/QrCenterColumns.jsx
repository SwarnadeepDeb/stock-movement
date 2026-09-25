import { Badge } from "@/components/ui/badge";
import QrStatusBadge from "../components/qr-center/QrStatusBadge";
import QrCenterRowActions from "../components/qr-center/QrCenterRowActions";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

// e.g. "8 Sets", "3 Sets · 2 Bundles" — omits a type entirely when this registration produced
// none of it, rather than always showing both at "0".
const formatTypeCounts = ({ SET, BUNDLE }) => {
  const parts = [];
  if (SET > 0) parts.push(`${SET} Set${SET === 1 ? "" : "s"}`);
  if (BUNDLE > 0) parts.push(`${BUNDLE} Bundle${BUNDLE === 1 ? "" : "s"}`);
  return parts.join(" · ") || "—";
};

// One row = one stock EVENT (a Stock In transaction or a transformation), not one QR — see
// qrCenter.service.js.
const registrationLabel = (row) =>
  row.registrationType === "TRANSFORMATION" ? `Transformation #${row.registrationId}` : `Stock In #${row.registrationId}`;

export const qrCenterColumns = [
  {
    id: "registration",
    header: "Stock Registration",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-foreground">{registrationLabel(row.original)}</span>
        <span className="text-xs text-muted-foreground">{dateFormatter.format(new Date(row.original.displayDate))}</span>
      </div>
    ),
  },
  {
    id: "design",
    header: "Design",
    cell: ({ row }) => {
      const { design, variant } = row.original;

      return (
        <div className="flex min-w-0 items-center gap-3">
          <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
            {variant.imageUrl && <img src={variant.imageUrl} alt={design.name} className="h-full w-full object-cover" />}
          </div>
          <span className="truncate text-sm font-medium text-foreground">
            {design.code ? `${design.code} · ` : ""}
            {design.name}
          </span>
        </div>
      );
    },
  },
  {
    id: "variant",
    header: "Variant",
    cell: ({ row }) => {
      const { colorName, colorHex } = row.original.variant;

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
    id: "type",
    header: "Type",
    cell: ({ row }) => <Badge variant="outline">{formatTypeCounts(row.original.typeCounts)}</Badge>,
  },
  {
    id: "qrCount",
    header: "QRs",
    cell: ({ row }) => <span className="text-sm tabular-nums text-foreground">{row.original.qrCount}</span>,
  },
  {
    id: "qrStatus",
    header: "QR Status",
    cell: ({ row }) => <QrStatusBadge status={row.original.qrStatus} />,
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <QrCenterRowActions registrationType={row.original.registrationType} registrationId={row.original.registrationId} />
    ),
  },
];
