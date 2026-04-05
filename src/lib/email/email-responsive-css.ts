import { resolveFullDocumentDarkLockCss } from "@/lib/email/email-client-dark-lock";

/**
 * Fluid-hybrid responsive helpers for table-based HTML emails.
 *
 * - Mobile-friendly rules: {@link getEmailResponsiveCss}
 * - Windows Outlook (Word HTML): {@link getOutlookMsoHeadBlock} + {@link wrapOutlookFluidHybridInner}
 *   (`<!--[if mso]>` ghost tables cap width at 600px; other clients ignore MSO blocks.)
 */

/** Main content column max width (fluid: width 100%, cap at this). */
export const EMAIL_FLUID_MAX_WIDTH_PX = 600;

/** Inline styles for the inner content wrapper table (use with width="100%"). */
export const EMAIL_FLUID_INNER_TABLE_INLINE = `width:100%;max-width:${EMAIL_FLUID_MAX_WIDTH_PX}px;margin-left:auto;margin-right:auto;`;

/**
 * Mobile stacking + gutter reduction + image fluidity.
 * Safe to include once per HTML document.
 */
export const EMAIL_RESPONSIVE_MARKER = "/* yugo-email-responsive-v1 */";

export function getEmailResponsiveCss(): string {
  return `${EMAIL_RESPONSIVE_MARKER}
@media only screen and (max-width: 480px) {
  .email-outer-gutter {
    padding-left: 12px !important;
    padding-right: 12px !important;
  }
  .email-content-pad {
    padding-left: 15px !important;
    padding-right: 15px !important;
  }
  td.email-content-pad.eq-inner {
    padding-top: 24px !important;
    padding-bottom: 28px !important;
  }
  .estate-email-content {
    padding-left: 15px !important;
    padding-right: 15px !important;
  }
}
/* iOS Mail often wraps addresses/phones in blue links — inherit surrounding ink. */
a[x-apple-data-detectors] {
  color: inherit !important;
  -webkit-text-fill-color: inherit !important;
  text-decoration: none !important;
  font-weight: 600 !important;
}
body, table, td {
  -webkit-text-size-adjust: 100%;
  -ms-text-size-adjust: 100%;
}
img {
  max-width: 100% !important;
  height: auto !important;
}
`.trim();
}

/** MSO-only rules for Windows Outlook (Word rendering engine). */
export function getOutlookMsoHeadBlock(): string {
  return `<!--[if mso]>
<style type="text/css">
  table { border-collapse: collapse; }
  table, td { mso-table-lspace: 0pt !important; mso-table-rspace: 0pt !important; }
  img { -ms-interpolation-mode: bicubic; }
</style>
<![endif]-->`;
}

const OUTLOOK_HYBRID_SENTINEL = "yugo-outlook-hybrid-wrap";

/**
 * Fixed-width ghost tables for Outlook desktop; other clients ignore the MSO conditionals
 * and use the fluid tables inside.
 */
export function wrapOutlookFluidHybridInner(
  innerHtml: string,
  maxWidthPx: number = EMAIL_FLUID_MAX_WIDTH_PX,
  /** When set, Outlook MSO ghost tables get matching `bgcolor` / background (avoids grey gutters on cream bodies). */
  msoPageBg?: string,
): string {
  const msoBg =
    msoPageBg && msoPageBg.length > 0
      ? ` bgcolor="${msoPageBg}" style="background-color:${msoPageBg};"`
      : "";
  const msoInnerTd = msoPageBg
    ? `padding:0;background-color:${msoPageBg};`
    : "padding:0;";
  return `<!--[if mso]>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"${msoBg}><tr><td align="center"${msoBg}>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${maxWidthPx}" style="width:${maxWidthPx}px;${msoPageBg ? `background-color:${msoPageBg};` : ""}"${msoPageBg ? ` bgcolor="${msoPageBg}"` : ""}>
<tr><td style="${msoInnerTd}"${msoPageBg ? ` bgcolor="${msoPageBg}"` : ""}>
<![endif]-->
<!-- ${OUTLOOK_HYBRID_SENTINEL} -->
${innerHtml}
<!-- ${OUTLOOK_HYBRID_SENTINEL} -->
<!--[if mso]>
</td></tr></table>
</td></tr></table>
<![endif]-->`;
}

/** Wrap first-level body content in Outlook hybrid tables when not already wrapped. */
export function wrapOutlookBodyIfNeeded(html: string): string {
  if (html.includes(OUTLOOK_HYBRID_SENTINEL)) return html;
  const bodyMatch = html.match(/<body[^>]*>/i);
  if (!bodyMatch || bodyMatch.index === undefined) return html;
  const lower = html.toLowerCase();
  const start = bodyMatch.index + bodyMatch[0].length;
  const end = lower.lastIndexOf("</body>");
  if (end === -1 || end <= start) return html;
  const inner = html.slice(start, end);
  const wrapped = wrapOutlookFluidHybridInner(inner.trim());
  return `${html.slice(0, start)}\n${wrapped}\n${html.slice(end)}`;
}

/** Insert responsive + Outlook head CSS into a full HTML document (before `</head>`). */
export function injectEmailResponsiveCssIntoFullDocument(html: string): string {
  if (html.includes(EMAIL_RESPONSIVE_MARKER)) return html;
  const darkLock = resolveFullDocumentDarkLockCss(html);
  const cssChunks = [darkLock, getEmailResponsiveCss()].filter(Boolean).join("\n");
  const block = `<style type="text/css">\n${cssChunks}\n</style>\n${getOutlookMsoHeadBlock()}\n`;
  const lower = html.toLowerCase();
  const headClose = lower.indexOf("</head>");
  let out: string;
  if (headClose !== -1) {
    out = `${html.slice(0, headClose)}${block}${html.slice(headClose)}`;
  } else {
    const bodyOpen = lower.indexOf("<body");
    if (bodyOpen !== -1) {
      out = `${html.slice(0, bodyOpen)}<head><meta charset="utf-8"/>${block}</head>${html.slice(bodyOpen)}`;
    } else {
      return html;
    }
  }
  return wrapOutlookBodyIfNeeded(out);
}
