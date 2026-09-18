import { jsPDF } from "jspdf";
import QRCode from "qrcode";

import { A4_PRESETS, buildTagLines, labelDims } from "./qrTagStudio";

// Same error-correction level and quiet zone as QrCodeImage, so a downloaded label scans the
// same as a printed one.
const QR_LEVEL = "M";
const QR_MARGIN = 2;

// Builds the tag sheets as a PDF file (never touches a printer). Each QR is drawn as vector
// squares straight from its module grid — never embedded as an image. Embedded canvas PNGs
// land in the PDF as raw, uncompressed pixels (~2.5 MB per QR, 200+ MB for a 3-sheet job);
// vectors are a few KB, print razor-sharp at any size and need no canvas. A4 jobs get one
// page per die-cut sheet; thermal jobs get one label-sized page per tag.
export function downloadTagSheetPdf({ engine, tags, a4Preset, a4StartAt, thermalPreset, qrmm, fields, buildTagData, fileName }) {
  if (tags.length === 0) throw new Error("There are no tags to download.");

  if (engine === "thermal") {
    const { w, h } = labelDims("thermal", thermalPreset, a4Preset);
    const pdf = new jsPDF({ unit: "mm", format: [w, h], orientation: w > h ? "landscape" : "portrait", compress: true });
    tags.forEach((tag, index) => {
      if (index > 0) pdf.addPage([w, h], w > h ? "landscape" : "portrait");
      drawLabel(pdf, tag, buildTagData(tag), fields, 0, 0, w, h, qrmm);
    });
    pdf.save(fileName);
    return;
  }

  const grid = A4_PRESETS[a4Preset];
  const perSheet = grid.c * grid.r;
  const skip = Math.max(0, Number(a4StartAt || 1) - 1);
  const originX = (210 - grid.c * grid.w) / 2;
  const originY = (297 - grid.r * grid.h) / 2;
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  tags.forEach((tag, index) => {
    const slot = index + skip;
    const slotOnSheet = slot % perSheet;
    if (index > 0 && slotOnSheet === 0) pdf.addPage("a4", "portrait");
    if (index === 0 && slot >= perSheet) {
      for (let page = 0; page < Math.floor(slot / perSheet); page++) pdf.addPage("a4", "portrait");
    }
    const x = originX + (slotOnSheet % grid.c) * grid.w;
    const y = originY + Math.floor(slotOnSheet / grid.c) * grid.h;
    drawLabel(pdf, tag, buildTagData(tag), fields, x, y, grid.w, grid.h, qrmm);
  });
  pdf.save(fileName);
}

// Draws `value` as a `size` mm square QR (quiet zone included) with its top-left at (x, y).
// Each horizontal run of dark modules is one rectangle, and the whole code is filled as a single
// path so PDF viewers don't anti-alias hairline seams between neighbouring rows.
function drawQr(pdf, value, x, y, size) {
  const { modules } = QRCode.create(String(value), { errorCorrectionLevel: QR_LEVEL });
  const count = modules.size;
  const cell = size / (count + QR_MARGIN * 2);

  pdf.setFillColor(0, 0, 0);
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!modules.get(row, col)) continue;
      const start = col;
      while (col + 1 < count && modules.get(row, col + 1)) col++;
      pdf.rect(x + (QR_MARGIN + start) * cell, y + (QR_MARGIN + row) * cell, (col - start + 1) * cell, cell, null);
    }
  }
  pdf.fill();
}

function drawLabel(pdf, tag, data, fields, x, y, w, h, qrmm) {
  const pad = 1;
  const qr = Math.min(qrmm, h - pad * 2);
  pdf.setDrawColor(203, 213, 225);
  pdf.setLineWidth(0.1);
  pdf.rect(x, y, w, h);
  drawQr(pdf, tag.qrValue ?? tag.code, x + pad, y + (h - qr) / 2, qr);

  const textX = x + pad * 2 + qr;
  const maxWidth = x + w - pad - textX;
  const SIZE = { title: 6, muted: 4.2, bold: 5, price: 5.5 };
  const lines = buildTagLines(tag, data, fields).map((line) => ({ text: line.text, size: SIZE[line.style], bold: line.style !== "muted" }));
  let cursor = y + (h - lines.length * 2.8) / 2 + 2.2;
  for (const line of lines) {
    pdf.setFont("courier", line.bold ? "bold" : "normal");
    pdf.setFontSize(line.size);
    pdf.setTextColor(15, 23, 42);
    pdf.text(pdf.splitTextToSize(String(line.text), maxWidth)[0], textX, cursor);
    cursor += 2.8;
  }
}
