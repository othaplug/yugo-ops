import {
  EMAIL_FLUID_MAX_WIDTH_PX,
  getEmailResponsiveCss,
  getOutlookMsoHeadBlock,
  injectEmailResponsiveCssIntoFullDocument,
  wrapOutlookFluidHybridInner,
} from "@/lib/email/email-responsive-css";
import { EMAIL_PREMIUM_PAGE } from "@/lib/email/email-brand-tokens";
import { getFragmentClientEmailDarkLockCss } from "@/lib/email/email-client-dark-lock";

const INSTRUMENT_SERIF_LINK =
  "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap";

/** Matches premium transactional table background so gutters are not a solid black slab in Gmail. */
const EMAIL_DOC_BG = EMAIL_PREMIUM_PAGE;

/** Estate booking confirmation only — wine page + cream type; same colours in light and dark mail UIs (no inversion). */
const ESTATE_WINE_DOC_BG = "#2B0416";
const ESTATE_WINE_DOC_INK = "#F9EDE4";

const ESTATE_WINE_EMAIL_DARK_LOCK_CSS = `
:root, html { color-scheme: only light; }
@media (prefers-color-scheme: dark) {
  body.yugo-estate-wine-email {
    background-color: ${ESTATE_WINE_DOC_BG} !important;
    color: ${ESTATE_WINE_DOC_INK} !important;
    -webkit-text-fill-color: ${ESTATE_WINE_DOC_INK} !important;
  }
  table.yugo-estate-wine-shell,
  table.yugo-estate-wine-shell > tbody > tr > td {
    background-color: ${ESTATE_WINE_DOC_BG} !important;
  }
  .yugo-estate-wine-shell img {
    filter: none !important;
    -webkit-filter: none !important;
  }
}
`;

/** Strip from the start of a fragment so {@link finalizeClientEmailHtml} can set wine document chrome (body + Outlook hybrid). */
export const YUGO_EMAIL_DOC_SURFACE_ESTATE_WINE_MARKER =
  "<!--yugo-doc-surface:estate-wine-->";

const ESTATE_WINE_SURFACE_PREFIX = /^\s*<!--\s*yugo-doc-surface:estate-wine\s*-->\s*/i;

const INSTRUMENT_SERIF_FACE = `
@font-face {
  font-family: 'Instrument Serif';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/instrumentserif/v5/jizBRFtNs2ka5fXjeivQ4LroWlx-6zUTjnTLgNs.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Instrument Serif';
  font-style: italic;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/instrumentserif/v5/jizHRFtNs2ka5fXjeivQ4LroWlx-6zAjjH7Motmp5g.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}`;

function wrapClientEmailDocument(
  innerHtml: string,
  surface: "default" | "estate-wine" = "default",
): string {
  if (surface === "estate-wine") {
    return `<!DOCTYPE html>
<html lang="en" style="color-scheme:only light;">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="only light" />
  <meta name="supported-color-schemes" content="light" />
  <link href="${INSTRUMENT_SERIF_LINK}" rel="stylesheet" />
  <style type="text/css">${INSTRUMENT_SERIF_FACE}${ESTATE_WINE_EMAIL_DARK_LOCK_CSS}${getEmailResponsiveCss()}</style>
  ${getOutlookMsoHeadBlock()}
</head>
<body class="yugo-client-email yugo-estate-wine-email" style="margin:0;padding:0;background:${ESTATE_WINE_DOC_BG};color:${ESTATE_WINE_DOC_INK};-webkit-text-fill-color:${ESTATE_WINE_DOC_INK};color-scheme:only light;" bgcolor="${ESTATE_WINE_DOC_BG}" data-ogsb="${ESTATE_WINE_DOC_BG}" data-ogsc="${ESTATE_WINE_DOC_INK}">
  ${wrapOutlookFluidHybridInner(innerHtml, EMAIL_FLUID_MAX_WIDTH_PX, ESTATE_WINE_DOC_BG)}
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html lang="en" style="color-scheme:only light;">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="only light" />
  <meta name="supported-color-schemes" content="light" />
  <link href="${INSTRUMENT_SERIF_LINK}" rel="stylesheet" />
  <style type="text/css">${INSTRUMENT_SERIF_FACE}${getFragmentClientEmailDarkLockCss()}${getEmailResponsiveCss()}</style>
  ${getOutlookMsoHeadBlock()}
</head>
<body class="yugo-client-email" style="margin:0;padding:0;background:${EMAIL_DOC_BG};color:#3A3532;-webkit-text-fill-color:#3A3532;color-scheme:only light;" bgcolor="${EMAIL_DOC_BG}" data-ogsb="${EMAIL_DOC_BG}" data-ogsc="#3A3532">
  ${wrapOutlookFluidHybridInner(innerHtml, EMAIL_FLUID_MAX_WIDTH_PX, EMAIL_DOC_BG)}
</body>
</html>`;
}

/**
 * Fragments get the standard wrapper + responsive CSS; full documents get CSS injected if missing.
 * Used by {@link sendEmail} and all `getResend().emails.send` traffic.
 */
export function finalizeClientEmailHtml(html: string): string {
  const trimmedLead = html.trimStart();
  let surface: "default" | "estate-wine" = "default";
  let content = html;
  if (ESTATE_WINE_SURFACE_PREFIX.test(trimmedLead)) {
    surface = "estate-wine";
    content = trimmedLead.replace(ESTATE_WINE_SURFACE_PREFIX, "");
  }

  const trimmed = content.trimStart();
  if (!trimmed.startsWith("<!DOCTYPE")) {
    return wrapClientEmailDocument(content, surface);
  }
  return injectEmailResponsiveCssIntoFullDocument(content);
}
