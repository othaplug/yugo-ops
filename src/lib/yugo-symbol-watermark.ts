/**
 * Centered low-opacity Yugo symbol watermark for jsPDF (server + client).
 */
import type jsPDF from "jspdf";
import { GState } from "jspdf";

function drawSymbolWatermarkOnCurrentPage(doc: jsPDF, symbolBase64: string): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const w = pageWidth * 0.36;
  const h = w;
  const x = (pageWidth - w) / 2;
  const y = (pageHeight - h) / 2;
  const opacity = 0.1;
  try {
    doc.saveGraphicsState();
    doc.setGState(new GState({ opacity }));
    doc.addImage(symbolBase64, "PNG", x, y, w, h);
    doc.restoreGraphicsState();
  } catch {
    try {
      doc.addImage(symbolBase64, "PNG", x, y, w, h);
    } catch {
      /* skip */
    }
  }
}

/**
 * Watermark page 1 and every page added via `addPage`.
 * Call immediately after `new jsPDF(...)`.
 */
export function attachYugoSymbolWatermark(doc: jsPDF, symbolPngBase64: string): void {
  drawSymbolWatermarkOnCurrentPage(doc, symbolPngBase64);
  doc.internal.events.subscribe("addPage", () => {
    drawSymbolWatermarkOnCurrentPage(doc, symbolPngBase64);
  });
}
