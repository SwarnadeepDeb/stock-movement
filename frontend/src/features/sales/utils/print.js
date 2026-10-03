import { DOCUMENT_CSS } from "./documentStyles.js";

// `footer` is the running line printed at the bottom-left of every page, beside "Page x of y"
// (Chrome / Edge 131+; older browsers simply omit it).
export function pageCss(footer = "") {
    const text = String(footer).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

    return `@page { size:A4; margin:10mm 10mm 13mm;
  @bottom-left { content:"${text}"; font:9px Arial,sans-serif; color:#444; }
  @bottom-right { content:"Page " counter(page) " of " counter(pages); font:9px Arial,sans-serif; color:#444; } }`;
}

// Prints one element by writing it into a detached iframe, rather than toggling print CSS on the
// whole app. The app's layout is a fixed sidebar plus a scrolling pane, which a print stylesheet
// has to fight; an iframe simply has none of that.
// `footer` as for pageCss.
export function printHtml(title, html, footer = "") {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(frame);

    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${DOCUMENT_CSS}
${pageCss(footer)}</style></head><body>${html}</body></html>`);
    doc.close();

    const cleanup = () => setTimeout(() => frame.remove(), 500);

    frame.contentWindow.addEventListener("afterprint", cleanup);
    // Give the iframe a tick to lay out before printing (and let the logo decode), or the first
    // page can come out blank.
    setTimeout(() => {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        // Safari never fires afterprint from an iframe, so this is the backstop.
        setTimeout(cleanup, 60000);
    }, 250);
}

export function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
    ));
}
