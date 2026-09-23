import { useEffect, useRef } from "react";
import QrTagPrintSheet from "../../stock-in/qrTagStudio/QrTagPrintSheet.jsx";
import { downloadTagSheetPdf } from "../../../utils/qrTagPdf.js";

// Runs a one-off tag sheet job — a PDF download or a browser print of thermal labels — then
// reports back. Only a print mounts the full-size sheet (one QR canvas per tag); the PDF draws its
// own vector QRs, so a download never pays for those canvases.
//   job: { mode: "pdf" | "print", tags }
export default function SheetJob({ job, sheet, buildTagData, fileName, onPrinted, onDone, onError }) {
    const callbacks = useRef({ onPrinted, onDone, onError });
    useEffect(() => {
        callbacks.current = { onPrinted, onDone, onError };
    });

    useEffect(() => {
        const handleAfterPrint = () => callbacks.current.onPrinted();
        // A print waits for the sheet's QR canvases, drawn by its own effects a moment after it mounts.
        const timer = setTimeout(() => {
            if (job.mode === "pdf") {
                try {
                    downloadTagSheetPdf({ ...sheet, tags: job.tags, buildTagData, fileName });
                    callbacks.current.onDone();
                } catch (error) {
                    callbacks.current.onError(error);
                }
                return;
            }
            window.addEventListener("afterprint", handleAfterPrint, { once: true });
            window.print();
        }, 200);

        return () => {
            clearTimeout(timer);
            window.removeEventListener("afterprint", handleAfterPrint);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [job]);

    if (job.mode === "pdf") return null;
    return <QrTagPrintSheet {...sheet} tags={job.tags} buildTagData={buildTagData} />;
}
