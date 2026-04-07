/**
 * Stabilizes Yugo HTML emails in Apple Mail / Gmail “dark” views: same hex palette as authored,
 * no client-side inversion of backgrounds, text, or raster logos.
 *
 * - {@link getFragmentClientEmailDarkLockCss} — default + estate-cream fragments wrapped by finalize-client-html.
 * - {@link getLightFullDocumentDarkLockCss} / {@link getDarkOpsEmailDarkLockCss} / etc. — full HTML docs via inject.
 */
import {
  EMAIL_FOREST,
  EMAIL_PREMIUM_MUTED_FILL,
  EMAIL_PREMIUM_PAGE,
  EMAIL_ROSE,
  EMAIL_WINE,
} from "@/lib/email/email-brand-tokens";

/** Admin kicker ink — matches `ACCENT_ROSE` in admin-templates. */
const ADMIN_KICKER_ROSE = "#9E4A5C";

export const EMAIL_CLIENT_DARK_LOCK_MARKER =
  "/* yugo-email-client-dark-lock-v2 */";

const ESTATE_CREAM_PAGE = "#F3EDE4";
const ESTATE_CREAM_CARD = "#FFFCF9";

/** Default transactional fragments (cream + estate cream layouts; excludes estate-wine body). */
export function getFragmentClientEmailDarkLockCss(): string {
  return `${EMAIL_CLIENT_DARK_LOCK_MARKER}
:root, html { color-scheme: only light; }
@media (prefers-color-scheme: dark) {
  body.yugo-client-email:not(.yugo-estate-wine-email) {
    background-color: ${EMAIL_PREMIUM_PAGE} !important;
    color: #3A3532 !important;
    -webkit-text-fill-color: #3A3532 !important;
  }
  body.yugo-client-email:not(.yugo-estate-wine-email) img {
    filter: none !important;
    -webkit-filter: none !important;
  }
  table.yugo-cream-email-shell,
  table.yugo-cream-email-shell > tbody > tr > td {
    background-color: ${EMAIL_PREMIUM_PAGE} !important;
  }
  td.yugo-cream-email-inner {
    background-color: ${EMAIL_PREMIUM_PAGE} !important;
    color: #3A3532 !important;
    -webkit-text-fill-color: #3A3532 !important;
  }
  body.yugo-client-email:not(.yugo-estate-wine-email) td.email-outer-gutter:not(.estate-email-outer) {
    background-color: ${EMAIL_PREMIUM_PAGE} !important;
  }
  body.yugo-client-email:not(.yugo-estate-wine-email) table.email-fluid-inner,
  body.yugo-client-email:not(.yugo-estate-wine-email) table.email-fluid-inner > tbody > tr > td {
    background-color: ${EMAIL_PREMIUM_PAGE} !important;
  }
  body.yugo-client-email:not(.yugo-estate-wine-email) td.estate-email-outer {
    background-color: ${ESTATE_CREAM_PAGE} !important;
  }
  body.yugo-client-email:not(.yugo-estate-wine-email) table.estate-email-inner,
  body.yugo-client-email:not(.yugo-estate-wine-email) td.estate-email-content {
    background-color: ${ESTATE_CREAM_CARD} !important;
    color: #3A3532 !important;
    -webkit-text-fill-color: #3A3532 !important;
  }
}
`;
}

/** Admin + simple light full documents. */
export function getLightFullDocumentDarkLockCss(): string {
  const page = EMAIL_PREMIUM_PAGE;
  const mutedFill = EMAIL_PREMIUM_MUTED_FILL;
  const ink = "#1a1a1a";
  const inkMuted = "#555";
  return `${EMAIL_CLIENT_DARK_LOCK_MARKER}
:root, html { color-scheme: only light !important; }
@media (prefers-color-scheme: dark) {
  html {
    background-color: ${page} !important;
  }
  body.yugo-light-email-doc {
    background-color: ${page} !important;
    color: ${ink} !important;
    -webkit-text-fill-color: ${ink} !important;
  }
  body.yugo-light-email-doc img {
    filter: none !important;
    -webkit-filter: none !important;
  }
  body.yugo-light-email-doc .yugo-admin-email-shell {
    background-color: ${page} !important;
  }
  body.yugo-light-email-doc .yugo-admin-email-card {
    background-color: ${page} !important;
    color: ${ink} !important;
    -webkit-text-fill-color: ${ink} !important;
    border: none !important;
    box-shadow: none !important;
  }
  body.yugo-light-email-doc .yugo-admin-email-body {
    color: ${ink} !important;
    -webkit-text-fill-color: ${ink} !important;
  }
  body.yugo-light-email-doc .yugo-admin-email-body p,
  body.yugo-light-email-doc .yugo-admin-email-body h1,
  body.yugo-light-email-doc .yugo-admin-email-body td,
  body.yugo-light-email-doc .yugo-admin-email-body th,
  body.yugo-light-email-doc .yugo-admin-email-body li {
    color: ${ink} !important;
    -webkit-text-fill-color: ${ink} !important;
  }
  body.yugo-light-email-doc .yugo-admin-email-body strong {
    color: ${ink} !important;
    -webkit-text-fill-color: ${ink} !important;
  }
  body.yugo-light-email-doc .yugo-admin-muted-fill {
    background-color: ${mutedFill} !important;
    color: ${ink} !important;
    -webkit-text-fill-color: ${ink} !important;
    border: none !important;
  }
  body.yugo-light-email-doc .yugo-admin-meter-track {
    background-color: ${mutedFill} !important;
    border: none !important;
  }
  body.yugo-light-email-doc .yugo-admin-bar-essential {
    background-color: ${EMAIL_FOREST} !important;
  }
  body.yugo-light-email-doc .yugo-admin-bar-signature {
    background-color: ${EMAIL_ROSE} !important;
  }
  body.yugo-light-email-doc .yugo-admin-bar-estate {
    background-color: ${EMAIL_WINE} !important;
  }
  /* Kickers / section labels (rose) */
  body.yugo-light-email-doc .yugo-admin-email-body div[style*="${ADMIN_KICKER_ROSE}"],
  body.yugo-light-email-doc .yugo-admin-email-body p[style*="${ADMIN_KICKER_ROSE}"] {
    color: ${ADMIN_KICKER_ROSE} !important;
    -webkit-text-fill-color: ${ADMIN_KICKER_ROSE} !important;
  }
  /* Muted secondary lines */
  body.yugo-light-email-doc .yugo-admin-email-body p[style*="${inkMuted}"],
  body.yugo-light-email-doc .yugo-admin-email-body span[style*="${inkMuted}"] {
    color: ${inkMuted} !important;
    -webkit-text-fill-color: ${inkMuted} !important;
  }
  /* Forest metrics */
  body.yugo-light-email-doc .yugo-admin-email-body strong[style*="${EMAIL_FOREST}"] {
    color: ${EMAIL_FOREST} !important;
    -webkit-text-fill-color: ${EMAIL_FOREST} !important;
  }
  body.yugo-light-email-doc .yugo-admin-urgency-badge {
    color: #FFFBF7 !important;
    -webkit-text-fill-color: #FFFBF7 !important;
    filter: none !important;
    -webkit-filter: none !important;
  }
  body.yugo-light-email-doc .yugo-admin-urgency-high {
    background-color: ${EMAIL_WINE} !important;
  }
  body.yugo-light-email-doc .yugo-admin-urgency-medium {
    background-color: ${EMAIL_ROSE} !important;
  }
  body.yugo-light-email-doc .yugo-admin-urgency-low {
    background-color: ${EMAIL_FOREST} !important;
  }
  body.yugo-light-email-doc a.yugo-admin-cta {
    background-color: ${EMAIL_FOREST} !important;
    color: #FFFFFF !important;
    -webkit-text-fill-color: #FFFFFF !important;
    border-color: transparent !important;
  }
  body.yugo-light-email-doc .yugo-admin-email-body a:not(.yugo-admin-cta) {
    color: ${EMAIL_FOREST} !important;
    -webkit-text-fill-color: ${EMAIL_FOREST} !important;
  }
  body.yugo-light-email-doc .yugo-admin-footer-note {
    color: ${inkMuted} !important;
    -webkit-text-fill-color: ${inkMuted} !important;
  }
  /* Transactional footer fragment (after Outlook hybrid wrap — not always body > table) */
  body.yugo-light-email-doc table[width="100%"][style*="margin-top:24px"],
  body.yugo-light-email-doc table[width="100%"][style*="margin-top: 24px"] {
    background-color: ${page} !important;
  }
  body.yugo-light-email-doc table[width="100%"][style*="margin-top:24px"] td,
  body.yugo-light-email-doc table[width="100%"][style*="margin-top: 24px"] td {
    background-color: ${page} !important;
    color: ${inkMuted} !important;
    -webkit-text-fill-color: ${inkMuted} !important;
  }
}
`;
}

/** Coordinator daily brief — intentional dark chrome. */
export function getDarkOpsEmailDarkLockCss(): string {
  return `${EMAIL_CLIENT_DARK_LOCK_MARKER}
:root, html { color-scheme: dark; }
@media (prefers-color-scheme: dark) {
  body.yugo-dark-ops-email {
    background-color: #0d0b08 !important;
    color: #e8e0d0 !important;
    -webkit-text-fill-color: #e8e0d0 !important;
  }
  body.yugo-dark-ops-email img {
    filter: none !important;
    -webkit-filter: none !important;
  }
}
`;
}

/** Partner statement / overdue — light gray page + mixed cards. */
export function getPartnerBillingEmailDarkLockCss(): string {
  return `${EMAIL_CLIENT_DARK_LOCK_MARKER}
:root, html { color-scheme: only light; }
@media (prefers-color-scheme: dark) {
  body.yugo-partner-billing-email {
    background-color: #f5f4f2 !important;
    color: #1a1714 !important;
    -webkit-text-fill-color: #1a1714 !important;
  }
  body.yugo-partner-billing-email img {
    filter: none !important;
    -webkit-filter: none !important;
  }
}
`;
}

/** Fallback for unknown full documents — at least prevent logo / icon inversion. */
export function getGenericFullDocumentImageDarkLockCss(): string {
  return `${EMAIL_CLIENT_DARK_LOCK_MARKER}
@media (prefers-color-scheme: dark) {
  img {
    filter: none !important;
    -webkit-filter: none !important;
  }
}
`;
}

export function resolveFullDocumentDarkLockCss(html: string): string {
  const h = html.toLowerCase();
  if (h.includes("yugo-quote-body")) return "";
  if (h.includes("yugo-dark-ops-email")) return getDarkOpsEmailDarkLockCss();
  if (h.includes("yugo-partner-billing-email"))
    return getPartnerBillingEmailDarkLockCss();
  if (h.includes("yugo-light-email-doc")) return getLightFullDocumentDarkLockCss();
  return getGenericFullDocumentImageDarkLockCss();
}
