import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

const require = createRequire(import.meta.url);
const { print: printWindows } = process.platform === "win32" ? require("pdf-to-printer") : {};
const PORT = Number(process.env.PRINT_AGENT_PORT || 4317);
const PRINTER_NAME = process.env.PRINTER_NAME?.trim();
const FRONTEND_ORIGINS = new Set(
  (process.env.FRONTEND_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean),
);
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const LABELS_PER_SHEET = 40;

function originAllowed(origin) {
  if (!origin) return false;
  if (FRONTEND_ORIGINS.has(origin)) return true;
  return process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function sendJson(response, statusCode, body, origin) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Private-Network": "true",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("Print request is too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function validateJob(job) {
  if (!Array.isArray(job.items) || job.items.length === 0 || job.items.length > 5000) {
    throw new Error("Provide between 1 and 5000 QR labels.");
  }
  const startAt = Number(job.startAt ?? 1);
  if (!Number.isInteger(startAt) || startAt < 1 || startAt > LABELS_PER_SHEET) {
    throw new Error("startAt must be a label position from 1 to 40.");
  }
  for (const item of job.items) {
    if (!item || typeof item !== "object" || !item.payload || typeof item.payload !== "object") {
      throw new Error("Each label must include a QR payload.");
    }
  }
  return { items: job.items, startAt, content: job.content ?? {} };
}

function drawLabel(doc, item, qrPng, content = {}) {
  const labelWidth = 52.5 * 72 / 25.4;
  const labelHeight = 29.7 * 72 / 25.4;
  const qrSize = Math.min(24, Math.max(9, Number(content.qrmm) || 17)) * 72 / 25.4;
  const padding = 1 * 72 / 25.4;
  const x = doc.x;
  const y = doc.y;
  const payload = item.payload;
  const isParent = item.type === "SET" || item.type === "BUNDLE";
  const designCode = String(item.design?.code ?? payload.designCode ?? "STOCK");
  const colorName = String(item.variant?.colorName ?? payload.colorName ?? "").toUpperCase();
  const stockId = String(item.displayCode ?? payload.setId ?? item.stockItemId ?? "");
  const price = Number(item.priceSnapshot ?? item.sellingPricePerPiece ?? 0);
  const piecesPerSet = Number(item.piecesPerSet ?? item.composition?.length ?? 0);
  const detail = isParent
    ? `${item.type === "BUNDLE" ? "SEMI" : "SET"} ${piecesPerSet}-PC`
    : `SIZE ${item.designSizeLabel ?? ""}`;
  const priceText = isParent
    ? `Rs. ${(price * piecesPerSet).toLocaleString("en-IN")} (SET)`
    : `Rs. ${price.toLocaleString("en-IN")}`;
  const textX = x + padding + qrSize + padding;
  const textWidth = labelWidth - (textX - x) - padding;
  const firstY = y + (labelHeight - qrSize) / 2;

  doc.rect(x, y, labelWidth, labelHeight).lineWidth(0.35).stroke("#111111");
  doc.image(qrPng, x + padding, y + (labelHeight - qrSize) / 2, { width: qrSize, height: qrSize });
  if (Array.isArray(item.labelLines) && item.labelLines.length > 0) {
    const styles = {
      title: ["Helvetica-Bold", 5.7, "#111111"],
      bold: ["Helvetica-Bold", 4.8, "#111111"],
      price: ["Helvetica-Bold", 5.1, "#111111"],
      muted: ["Helvetica", 4.4, "#555555"],
    };
    const lineHeight = 6.2;
    const startY = y + Math.max(padding, (labelHeight - item.labelLines.length * lineHeight) / 2);
    item.labelLines.forEach((line, index) => {
      const [font, size, color] = styles[line.style] ?? styles.muted;
      // Built-in PDF fonts have no rupee glyph.
      doc.font(font).fontSize(size).fillColor(color)
        .text(String(line.text).replaceAll("₹", "Rs."), textX, startY + index * lineHeight, { width: textWidth, height: lineHeight, ellipsis: true, lineBreak: false });
    });
    return;
  }

  doc.font("Helvetica-Bold").fontSize(5.7).fillColor("#111111")
    .text(stockId, textX, firstY, { width: textWidth, height: 6, ellipsis: true, lineBreak: false });
  doc.font("Helvetica").fontSize(4.8).fillColor("#555555")
    .text(`${designCode} · ${colorName}`, textX, firstY + 7, { width: textWidth, height: 5, ellipsis: true, lineBreak: false });
  doc.font(isParent ? "Helvetica-Bold" : "Helvetica").fontSize(4.8).fillColor("#555555")
    .text(detail, textX, firstY + 13, { width: textWidth, height: 5, ellipsis: true, lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(5.1).fillColor("#111111")
    .text(priceText, textX, firstY + 19, { width: textWidth, height: 6, ellipsis: true, lineBreak: false });
}

async function createA4Pdf(items, startAt, content) {
  const filePath = path.join(os.tmpdir(), `stock-movement-labels-${randomUUID()}.pdf`);
  const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true, compress: true });
  const output = [];
  doc.on("data", (chunk) => output.push(chunk));
  const completed = new Promise((resolve, reject) => {
    doc.once("end", resolve);
    doc.once("error", reject);
  });

  const labelWidth = 52.5 * 72 / 25.4;
  const labelHeight = 29.7 * 72 / 25.4;
  const sheetWidth = 210 * 72 / 25.4;
  const sheetHeight = 297 * 72 / 25.4;
  const columns = 4;
  const rows = 10;
  const gridWidth = labelWidth * columns;
  const gridHeight = labelHeight * rows;
  const left = (sheetWidth - gridWidth) / 2;
  const top = (sheetHeight - gridHeight) / 2;
  const initialSkip = startAt - 1;
  const totalPages = Math.max(1, Math.ceil((items.length + initialSkip) / LABELS_PER_SHEET));
  let itemIndex = 0;

  for (let page = 0; page < totalPages; page += 1) {
    if (page > 0) doc.addPage({ size: "A4", margin: 0 });
    for (let slot = 0; slot < LABELS_PER_SHEET; slot += 1) {
      const absoluteSlot = page * LABELS_PER_SHEET + slot;
      if (absoluteSlot < initialSkip || itemIndex >= items.length) continue;
      const item = items[itemIndex++];
      // The QR carries the tag's saved shortCode — the code every scan station resolves. Older
      // callers that don't send it still get the JSON payload, which the backend also accepts.
      const qrPng = await QRCode.toBuffer(item.shortCode ?? JSON.stringify(item.payload), {
        type: "png",
        errorCorrectionLevel: "M",
        margin: 2,
        width: 512,
      });
      const column = slot % columns;
      const row = Math.floor(slot / columns);
      doc.x = left + column * labelWidth;
      doc.y = top + row * labelHeight;
      drawLabel(doc, item, qrPng, content);
    }
  }

  doc.end();
  await completed;
  const buffer = Buffer.concat(output);
  const { writeFile } = await import("node:fs/promises");
  await writeFile(filePath, buffer, { mode: 0o600 });
  return filePath;
}

async function spoolPdf(filePath) {
  if (process.platform === "win32") {
    await printWindows(filePath, {
      ...(PRINTER_NAME ? { printer: PRINTER_NAME } : {}),
      paperSize: "A4",
      scale: "noscale",
      silent: true,
    });
    return;
  }
  if (process.platform === "darwin" || process.platform === "linux") {
    const { spawn } = await import("node:child_process");
    const args = ["-o", "media=A4", "-o", "scaling=100"];
    if (PRINTER_NAME) args.push("-d", PRINTER_NAME);
    args.push(filePath);
    await new Promise((resolve, reject) => {
      const child = spawn("lp", args, { stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "";
      child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
      child.once("error", reject);
      child.once("close", (code) => code === 0 ? resolve() : reject(new Error(stderr.trim() || `lp exited with ${code}`)));
    });
    return;
  }
  throw new Error(`Unsupported print-agent platform: ${process.platform}`);
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (!originAllowed(origin)) {
    response.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "This website is not allowed to use the local print agent." }));
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Private-Network": "true",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    });
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { status: "ready", platform: process.platform, printer: PRINTER_NAME || "system default" }, origin);
    return;
  }

  if (request.method !== "POST" || request.url !== "/print/a4") {
    sendJson(response, 404, { error: "Not found." }, origin);
    return;
  }

  let pdfPath;
  try {
    const job = validateJob(await readJson(request));
    pdfPath = await createA4Pdf(job.items, job.startAt, job.content);
    await spoolPdf(pdfPath);
    sendJson(response, 202, { status: "submitted", count: job.items.length, printer: PRINTER_NAME || "system default" }, origin);
  } catch (error) {
    sendJson(response, 400, { error: error.message || "Unable to submit print job." }, origin);
  } finally {
    if (pdfPath) {
      const { unlink } = await import("node:fs/promises");
      await unlink(pdfPath).catch(() => {});
    }
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Stock Movement print agent listening on http://127.0.0.1:${PORT}`);
  console.log(`Allowed website origins: ${[...FRONTEND_ORIGINS].join(", ") || "none (set FRONTEND_ORIGINS)"}`);
  console.log(`Printer: ${PRINTER_NAME || "system default"}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
