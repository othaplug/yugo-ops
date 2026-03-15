/**
 * Premium PDF branding — single source of truth for all generated PDFs and documents.
 * Aligns with globals.css and STYLING_COLORS: wine, gold, cream, Instrument Serif (hero), DM Sans / system (body).
 * jsPDF does not support web fonts; we use Times (serif) for hero and Helvetica for body.
 */
import type { jsPDF } from "jspdf";

// ─── Hex (for reference / non-PDF) ─────────────────────────────────────────
export const WINE_HEX = "#5C1A33";
export const GOLD_HEX = "#C9A962";
export const GOLD_DARK_HEX = "#B89A52";
export const CREAM_BG_HEX = "#FAF7F2";
export const CREAM_TEXT_HEX = "#E8E5E0";
export const DARK_HEX = "#0D0D0D";
export const GRAY_HEX = "#666666";

// ─── RGB tuples for jsPDF (0–255) ──────────────────────────────────────────
export const WINE: [number, number, number] = [92, 26, 51];       // #5C1A33
export const GOLD: [number, number, number] = [201, 169, 98];     // #C9A962
export const GOLD_DARK: [number, number, number] = [184, 154, 82]; // #B89A52
export const CREAM_BG: [number, number, number] = [250, 247, 242]; // #FAF7F2
export const CREAM_TEXT: [number, number, number] = [232, 229, 224]; // #E8E5E0
export const DARK: [number, number, number] = [13, 13, 13];       // #0D0D0D
export const GRAY: [number, number, number] = [115, 115, 115];    // muted
export const GRAY_LIGHT: [number, number, number] = [200, 200, 200];
export const GREEN: [number, number, number] = [45, 159, 90];     // #2D9F5A

// Hero = serif (Times approximates Instrument Serif in PDF)
const FONT_HERO = "times";
const FONT_BODY = "helvetica";

/**
 * Draw premium Yugo header: wine "YUGO", gold italic "The Art of Moving", gold divider.
 * Returns the y position after the header.
 */
export function drawYugoHeader(
  doc: jsPDF,
  options: {
    yStart?: number;
    centerX?: number;
    width?: number;
    margin?: number;
  } = {}
): number {
  const yStart = options.yStart ?? 36;
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = options.centerX ?? pageWidth / 2;
  const margin = options.margin ?? 50;
  const lineEnd = options.width != null ? centerX + options.width / 2 : pageWidth - margin;
  const lineStart = options.width != null ? centerX - options.width / 2 : margin;

  doc.setFont(FONT_HERO, "bold");
  doc.setFontSize(24);
  doc.setTextColor(...WINE);
  doc.text("YUGO", centerX, yStart, { align: "center" });

  doc.setFont(FONT_HERO, "italic");
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text("The Art of Moving", centerX, yStart + 6, { align: "center" });

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(lineStart, yStart + 12, lineEnd, yStart + 12);

  return yStart + 22;
}

/**
 * Top accent bar (full width) — wine or gold.
 */
export function drawTopAccentBar(doc: jsPDF, useWine = false): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...(useWine ? WINE : GOLD));
  doc.rect(0, 0, pageWidth, 4, "F");
}

/**
 * Bottom accent bar (full width).
 */
export function drawBottomAccentBar(doc: jsPDF, useWine = false): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFillColor(...(useWine ? WINE : GOLD));
  doc.rect(0, pageHeight - 4, pageWidth, 4, "F");
}

/**
 * Standard footer for all PDFs.
 */
export function drawYugoFooter(doc: jsPDF, options: { y?: number } = {}): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const y = options.y ?? 282;
  doc.setFontSize(7);
  doc.setFont(FONT_BODY, "normal");
  doc.setTextColor(...GRAY);
  doc.text("Yugo Technologies Inc. · Toronto, ON · helloyugo.com", pageWidth / 2, y, { align: "center" });
}

/**
 * Table header style for premium docs: cream background, wine or dark text.
 */
export function getTableHeadStyles(wineHeadings = false): { fillColor: number[]; textColor: number[]; fontStyle: "bold"; fontSize: number } {
  return {
    fillColor: CREAM_BG,
    textColor: wineHeadings ? WINE : DARK,
    fontStyle: "bold",
    fontSize: 8,
  };
}

/**
 * Alternate row style: very light cream.
 */
export const TABLE_ALT_ROW: [number, number, number] = [252, 251, 249];

/**
 * Set body text style (dark, helvetica).
 */
export function setBodyText(doc: jsPDF, size = 9): void {
  doc.setFont(FONT_BODY, "normal");
  doc.setFontSize(size);
  doc.setTextColor(...DARK);
}

/**
 * Set section label (gold, bold, small caps feel).
 */
export function setSectionLabel(doc: jsPDF, size = 8): void {
  doc.setFont(FONT_BODY, "bold");
  doc.setFontSize(size);
  doc.setTextColor(...GOLD);
}

/**
 * Set hero title (wine, serif) for document title lines.
 */
export function setHeroTitle(doc: jsPDF, size = 18): void {
  doc.setFont(FONT_HERO, "bold");
  doc.setFontSize(size);
  doc.setTextColor(...WINE);
}
