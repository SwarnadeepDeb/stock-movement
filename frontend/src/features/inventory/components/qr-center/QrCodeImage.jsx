import { QRCodeCanvas } from "qrcode.react";

// Single place that decides how this app renders a QR — size scales with the caller, but
// error-correction level and margin stay fixed so every downloaded/printed QR is generated
// the same way. Canvas (not SVG) so a preview/print caller can also read pixel data off it
// via canvasRef for PNG download (canvas.toDataURL).
//
// The canvas is always rasterized at a much higher pixel density than its on-screen `size`
// (qrcode.react already multiplies by window.devicePixelRatio for retina screens, but that
// still isn't enough detail for a browser's print/"Save as PDF" pipeline, which samples the
// page at print resolution — printing a canvas that only has screen-resolution pixels is
// what makes small QR codes look blurry on paper). Oversampling here and letting CSS scale
// the canvas back down to `size`/`style` keeps it crisp on screen *and* in print.
const OVERSAMPLE = 4;
const MIN_RENDER_SIZE = 160;

const QrCodeImage = ({ value, size = 160, canvasRef, className, style }) => (
  <QRCodeCanvas
    ref={canvasRef}
    value={value}
    size={Math.max(size * OVERSAMPLE, MIN_RENDER_SIZE)}
    level="M"
    marginSize={2}
    className={className}
    style={{ width: size, height: size, ...style }}
  />
);

export default QrCodeImage;
