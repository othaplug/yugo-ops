/**
 * Premium PDF branding — single source of truth for all generated PDFs and documents.
 * Aligns with globals.css and STYLING_COLORS: wine, gold, cream, Instrument Serif (hero), DM Sans / system (body).
 * jsPDF does not support web fonts; we use Times (serif) for hero and Helvetica for body.
 */
import type { jsPDF } from "jspdf";

// ─── Hex (for reference / non-PDF) ─────────────────────────────────────────
export const WINE_HEX = "#2B0416";
export const GOLD_HEX = "#66143D";
export const GOLD_DARK_HEX = "#B89A52";
export const CREAM_BG_HEX = "#F9EDE4";
export const CREAM_TEXT_HEX = "#E8E5E0";
export const DARK_HEX = "#0D0D0D";
export const GRAY_HEX = "#666666";

// ─── RGB tuples for jsPDF (0–255) ──────────────────────────────────────────
export const WINE: [number, number, number] = [92, 26, 51]; // #2B0416
export const GOLD: [number, number, number] = [201, 169, 98]; // #66143D
export const GOLD_DARK: [number, number, number] = [184, 154, 82]; // #B89A52
export const CREAM_BG: [number, number, number] = [250, 247, 242]; // #F9EDE4
export const CREAM_TEXT: [number, number, number] = [232, 229, 224]; // #E8E5E0
export const DARK: [number, number, number] = [13, 13, 13]; // #0D0D0D
export const GRAY: [number, number, number] = [115, 115, 115]; // muted
export const GRAY_LIGHT: [number, number, number] = [200, 200, 200];
export const GREEN: [number, number, number] = [45, 159, 90]; // #2D9F5A

// Hero = serif (Times approximates Instrument Serif in PDF)
const FONT_HERO = "times";
const FONT_BODY = "helvetica";

/**
 * Draw Yugo logo image (PNG base64). Use logoBase64 from loadYugoLogoBase64().
 * Returns the y position after the logo.
 */
export function drawYugoLogo(
  doc: jsPDF,
  logoBase64: string,
  options: { x?: number; y?: number; width?: number; margin?: number } = {},
): number {
  const margin = options.margin ?? 50;
  const x = options.x ?? margin;
  const y = options.y ?? 36;
  const w = options.width ?? 72;
  const h = w * 0.28;
  try {
    doc.addImage(logoBase64, "PNG", x, y, w, h);
  } catch {
    // If image fails, skip
  }
  return y + h;
}

/**
 * Draw header: optional left logo only (no wordmark text), then gold rule.
 * Branding is the logo asset; plain "Yugo" text is not drawn.
 */
export function drawYugoHeader(
  doc: jsPDF,
  options: {
    yStart?: number;
    centerX?: number;
    width?: number;
    margin?: number;
    logoBase64?: string;
  } = {},
): number {
  const yStart = options.yStart ?? 36;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = options.margin ?? 50;
  const logoBase64 = options.logoBase64;

  const centerX = options.centerX ?? pageWidth / 2;
  const lineEnd =
    options.width != null ? centerX + options.width / 2 : pageWidth - margin;
  const lineStart =
    options.width != null ? centerX - options.width / 2 : margin;

  let lineY: number;
  if (logoBase64) {
    const logoW = 72;
    const logoH = logoW * 0.28;
    try {
      doc.addImage(logoBase64, "PNG", margin, yStart, logoW, logoH);
    } catch {
      /* skip */
    }
    lineY = yStart + logoH + 6;
  } else {
    lineY = yStart + 4;
  }

  doc.setDrawColor(...GOLD_DARK);
  doc.setLineWidth(0.5);
  doc.line(lineStart, lineY, lineEnd, lineY);

  return lineY + 12;
}

/**
 * Top accent bar (full width) — wine or gold.
 */
export function drawTopAccentBar(doc: jsPDF, useWine = false): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...(useWine ? WINE : GOLD));
  doc.rect(0, 0, pageWidth, 4, "F");
}

/** Full-width wine gradient strip (premium receipts). */
export function drawTopWineGradientBar(doc: jsPDF, heightPt = 7): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const h = heightPt;
  const steps: [number, number, number][] = [
    [120, 36, 58],
    [92, 26, 51],
    [58, 16, 32],
  ];
  const seg = pageWidth / steps.length;
  steps.forEach((rgb, i) => {
    doc.setFillColor(...rgb);
    doc.rect(i * seg, 0, seg + 1, h, "F");
  });
}

/**
 * Centered Yugo logo + gold rule, no duplicate wordmark text.
 * Returns Y position below the rule for body content.
 */
export function drawCenteredYugoLogoBlock(
  doc: jsPDF,
  logoDataUri: string,
  yStart: number,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const logoW = Math.min(108, pageWidth - MARGIN * 2);
  const logoH = logoW * 0.28;
  const x = (pageWidth - logoW) / 2;
  if (logoDataUri) {
    try {
      doc.addImage(logoDataUri, "PNG", x, yStart, logoW, logoH);
    } catch {
      /* wordmark omitted when image fails; rule still draws */
    }
  }
  const lineY = yStart + (logoDataUri ? logoH : 0) + 8;
  doc.setDrawColor(...GOLD_DARK);
  doc.setLineWidth(0.55);
  doc.line(MARGIN, lineY, pageWidth - MARGIN, lineY);
  return lineY + 14;
}

/**
 * Client signature block for US Letter PDFs in points (e.g. margin 50). Matches payment receipt layout.
 */
export function drawClientSignatureLetter(
  doc: jsPDF,
  dataUrl: string,
  y: number,
  marginPt: number,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentW = pageWidth - marginPt * 2;
  const boxW = Math.min(contentW, 88);
  const boxInnerH = 18;
  const framePad = 5;
  doc.setFont(FONT_BODY, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...GOLD_DARK);
  doc.text("CLIENT SIGNATURE", marginPt, y);
  doc.setDrawColor(...GOLD_DARK);
  doc.setLineWidth(0.35);
  const boxY = y + 4;
  doc.setFillColor(252, 251, 249);
  doc.rect(marginPt, boxY, boxW, boxInnerH + framePad, "FD");
  const innerPad = 3;
  const imgW = boxW - innerPad * 2;
  const imgH = boxInnerH - 2;
  try {
    doc.addImage(dataUrl, "PNG", marginPt + innerPad, boxY + 2.5, imgW, imgH);
  } catch {
    setBodyText(doc, 8);
    doc.setTextColor(...GRAY);
    doc.text("Signature on file", marginPt + innerPad, boxY + boxInnerH / 2 + 2);
  }
  return boxY + boxInnerH + framePad + 11;
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
export function drawYugoFooter(
  doc: jsPDF,
  options: { y?: number; line?: string } = {},
): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const y = options.y ?? 282;
  const line =
    options.line ||
    process.env.COMPANY_PDF_FOOTER_LINE ||
    "Professional moving services · Toronto, ON";
  doc.setFontSize(7);
  doc.setFont(FONT_BODY, "normal");
  doc.setTextColor(...GRAY);
  doc.text(line, pageWidth / 2, y, { align: "center" });
}

/**
 * Table header style for premium docs: cream background, wine or dark text.
 */
export function getTableHeadStyles(wineHeadings = false): {
  fillColor: number[];
  textColor: number[];
  fontStyle: "bold";
  fontSize: number;
} {
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
  doc.setTextColor(...GOLD_DARK);
}

/**
 * Set hero title (wine, serif) for document title lines.
 */
export function setHeroTitle(doc: jsPDF, size = 18): void {
  doc.setFont(FONT_HERO, "bold");
  doc.setFontSize(size);
  doc.setTextColor(...WINE);
}

/**
 * Draw a subtle box for a key info block (Yugo style: cream border, wine/gold accents).
 */
export function drawInfoBox(
  doc: jsPDF,
  options: { x: number; y: number; width: number; height: number },
): void {
  doc.setDrawColor(...GOLD_DARK);
  doc.setLineWidth(0.3);
  doc.setFillColor(...CREAM_BG);
  doc.rect(options.x, options.y, options.width, options.height, "FD");
}

/**
 * Vertical spacing constant for consistent section gaps.
 */
export const SECTION_GAP = 10;
export const SUB_SECTION_GAP = 6;

/**
 * Standard left margin for all PDFs.
 */
export const MARGIN = 20;

/**
 * Set up a full page with top accent bar, Yugo header, and schedule the footer/bottom bar.
 * Call once per page at the start of each new page.
 * Returns the y position where body content should begin.
 *
 * @param useWineBar - true for wine top bar (default), false for gold
 */
export function drawPageTemplate(
  doc: jsPDF,
  options: { useWineBar?: boolean; logoBase64?: string } = {},
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;
  drawTopAccentBar(doc, options.useWineBar ?? true);
  const y = drawYugoHeader(doc, {
    yStart: 16,
    centerX,
    margin: MARGIN,
    logoBase64: options.logoBase64,
  });
  drawYugoFooter(doc);
  drawBottomAccentBar(doc, options.useWineBar ?? true);
  return y + 4;
}

/** Premium client receipt: gradient top bar, centered logo, footer bars. */
export function drawSignOffReceiptPageShell(
  doc: jsPDF,
  logoDataUri: string,
): number {
  drawTopWineGradientBar(doc, 7);
  const y = drawCenteredYugoLogoBlock(doc, logoDataUri, 14);
  drawYugoFooter(doc);
  drawBottomAccentBar(doc, true);
  return y;
}

/**
 * Draw a section label + gold underline rule for semantic document sections.
 */
export function drawSectionHeading(
  doc: jsPDF,
  label: string,
  x: number,
  y: number,
  width = 170,
): number {
  doc.setFont(FONT_BODY, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...GOLD_DARK);
  doc.text(label.toUpperCase(), x, y);
  doc.setDrawColor(...GOLD_DARK);
  doc.setLineWidth(0.25);
  doc.line(x, y + 2, x + width, y + 2);
  return y + 12;
}
