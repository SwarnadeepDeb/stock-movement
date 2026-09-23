import { useRef, useState } from "react";
import { DownloadIcon, PrinterIcon } from "lucide-react";

import ActionModal from "@/components/shared/ActionModal";
import { Button } from "@/components/ui/button";
import QrCodeImage from "./QrCodeImage";
import { buildQrFilename, buildQrValue } from "../../utils/qrLabel";

// Opened via useModal (see BundleList/LoosePiecesSummary for the same pattern) — manages
// only its own open/close animation state; the QR data itself comes from the row it was
// opened for.
const QrPreviewDialog = ({ item, onPrint, onClose }) => {
  const [open, setOpen] = useState(true);
  const canvasRef = useRef(null);

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      setTimeout(onClose, 150);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = buildQrFilename(item);
    link.click();
  };

  return (
    <ActionModal openActionModal={open} setOpenActionModal={handleOpenChange} title="QR Code">
      <div className="flex flex-col items-center gap-4 p-4 sm:p-6">
        <div className="rounded-xl border border-border bg-white p-4">
          <QrCodeImage value={item.qr.shortCode ?? buildQrValue(item.qr.payload)} size={180} canvasRef={canvasRef} />
        </div>

        <div className="flex flex-col items-center gap-0.5 text-center">
          <span className="text-sm font-semibold text-foreground">
            {item.designCode ? `${item.designCode} · ` : ""}
            {item.designName}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <span
              className="size-2.5 shrink-0 rounded-full border border-black/10"
              style={{ backgroundColor: item.colorHex }}
            />
            {item.colorName} · {item.type}
          </span>
          <span className="text-xs text-muted-foreground">Stock #{item.stockItemId}</span>
        </div>

        <div className="flex w-full gap-2">
          <Button type="button" variant="outline" className="h-11 flex-1" onClick={onPrint}>
            <PrinterIcon className="size-4" />
            Print
          </Button>
          <Button type="button" className="h-11 flex-1" onClick={handleDownload}>
            <DownloadIcon className="size-4" />
            Download
          </Button>
        </div>
      </div>
    </ActionModal>
  );
};

export default QrPreviewDialog;
