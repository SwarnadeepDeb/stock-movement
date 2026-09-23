import { Badge } from "@/components/ui/badge";

// A registration is "READY" once every QR-eligible stock item it produced has a QR — true for
// every normal Stock In (QR generation is transactional, see stockIn.service.js) — "PARTIAL"
// only surfaces the rare case where a backfill is still pending (see qrCenter.service.js).
const STATUS_LABELS = {
  READY: "QR Ready",
  PARTIAL: "Partially Generated",
};

const QrStatusBadge = ({ status }) => (
  <Badge variant={status === "READY" ? "secondary" : "outline"}>{STATUS_LABELS[status] ?? status}</Badge>
);

export default QrStatusBadge;
