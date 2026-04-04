import {
  EMAIL_FLUID_MAX_WIDTH_PX,
  getEmailResponsiveCss,
  getOutlookMsoHeadBlock,
  injectEmailResponsiveCssIntoFullDocument,
  wrapOutlookFluidHybridInner,
} from "@/lib/email/email-responsive-css";

const INSTRUMENT_SERIF_LINK =
  "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap";

/** Matches premium transactional table background so gutters are not a solid black slab in Gmail. */
const EMAIL_DOC_BG = "#FCF9F4";

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

function wrapClientEmailDocument(innerHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <link href="${INSTRUMENT_SERIF_LINK}" rel="stylesheet" />
  <style type="text/css">${INSTRUMENT_SERIF_FACE}${getEmailResponsiveCss()}</style>
  ${getOutlookMsoHeadBlock()}
</head>
<body style="margin:0;padding:0;background:${EMAIL_DOC_BG};color-scheme:light;">
  ${wrapOutlookFluidHybridInner(innerHtml, EMAIL_FLUID_MAX_WIDTH_PX, EMAIL_DOC_BG)}
</body>
</html>`;
}

/**
 * Fragments get the standard wrapper + responsive CSS; full documents get CSS injected if missing.
 * Used by {@link sendEmail} and all `getResend().emails.send` traffic.
 */
export function finalizeClientEmailHtml(html: string): string {
  const trimmed = html.trimStart();
  if (!trimmed.startsWith("<!DOCTYPE")) {
    return wrapClientEmailDocument(html);
  }
  return injectEmailResponsiveCssIntoFullDocument(html);
}
