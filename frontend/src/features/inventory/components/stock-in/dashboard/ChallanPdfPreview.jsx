import { useEffect, useMemo, useRef } from "react";
import { Download, Printer } from "lucide-react";

import ActionModal from "@/components/shared/ActionModal";
import { Button } from "@/components/ui/button";
import { buildChallanPdf, challanFileName, downloadBlob } from "../../../utils/challanPdf";

// 148 x 210 mm challan preview. The preview IS the PDF (same jsPDF document), so what is printed
// or downloaded is exactly what was reviewed.
const ChallanPdfPreview = ({ challan, onClose, onActivity }) => {
  const frameRef = useRef(null);

  const built = useMemo(() => {
    const { doc, pageCount } = buildChallanPdf(challan);
    const blob = doc.output("blob");
    return { blob, pageCount, url: URL.createObjectURL(blob) };
  }, [challan]);

  useEffect(() => () => URL.revokeObjectURL(built.url), [built]);

  const handlePrint = () => {
    frameRef.current?.contentWindow?.focus();
    frameRef.current?.contentWindow?.print();
    onActivity?.("PRINT");
  };

  const handleDownload = () => {
    downloadBlob(built.blob, challanFileName(challan, "pdf"));
    onActivity?.("PDF");
  };

  return (
    <ActionModal
      openActionModal
      setOpenActionModal={(open) => !open && onClose()}
      title={`Challan ${challan.challanNo}`}
      subtitle={`${challan.serialLabel} · ${challan.jobberName ?? "—"} · ${built.pageCount} page${built.pageCount > 1 ? "s" : ""}, 148 × 210 mm`}
      className="sm:max-w-3xl"
    >
      <div className="space-y-4 p-4 sm:p-6">
        <iframe ref={frameRef} title="Challan preview" src={built.url} className="h-[60vh] w-full rounded-lg border border-slate-200 bg-slate-100" />
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          <Button type="button" variant="outline" onClick={handleDownload} className="gap-2">
            <Download className="size-4" /> Download PDF
          </Button>
          <Button type="button" onClick={handlePrint} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
            <Printer className="size-4" /> Print
          </Button>
        </div>
      </div>
    </ActionModal>
  );
};

export default ChallanPdfPreview;
