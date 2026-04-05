/**
 * Stabilizes Yugo HTML emails in Apple Mail / Gmail “dark” views: same hex palette as authored,
 * no client-side inversion of backgrounds, text, or raster logos.
 *
 * - {@link getFragmentClientEmailDarkLockCss} — default + estate-cream fragments wrapped by finalize-client-html.
 * - {@link getLightFullDocumentDarkLockCss} / {@link getDarkOpsEmailDarkLockCss} / etc. — full HTML docs via inject.
 */
import { EMAIL_PREMIUM_PAGE } from "@/lib/email/email-brand-tokens";

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
  return `${EMAIL_CLIENT_DARK_LOCK_MARKER}
:root, html { color-scheme: only light; }
@media (prefers-color-scheme: dark) {
  body.yugo-light-email-doc {
    background-color: ${EMAIL_PREMIUM_PAGE} !important;
    color: #1a1a1a !important;
    -webkit-text-fill-color: #1a1a1a !important;
  }
  body.yugo-light-email-doc img {
    filter: none !important;
    -webkit-filter: none !important;
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
