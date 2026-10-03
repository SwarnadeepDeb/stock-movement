import { DOCUMENT_CSS } from "../utils/documentStyles.js";

// Shows the document exactly as it will print, using the same HTML and stylesheet the print path
// uses, so what is on screen and what comes out of the printer can never drift apart. Rendered
// in a sandboxed iframe rather than inline: the print stylesheet assumes it owns the page, and
// inlining it would leak those rules into the app. The page is laid out at A4 width and padded
// like the printed margin.
const DocumentPreview = ({ html }) => (
    <div className="glass-card overflow-x-auto rounded-[24px] p-6">
        <iframe
            title="Document preview"
            sandbox=""
            className="mx-auto h-[1123px] w-[794px] max-w-none rounded-md border border-slate-200 bg-white shadow-sm"
            srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>${DOCUMENT_CSS}
body { padding:10mm; }</style></head><body>${html}</body></html>`}
        />
    </div>
);

export default DocumentPreview;
