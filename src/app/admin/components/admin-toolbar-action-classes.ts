/**
 * Shared layout/chrome for admin detail toolbars (Edit / Download / Delete and similar rows).
 * Borderless forward actions: DM Sans caps + tracked label, wine/cream ink via `--yugo-primary-text`
 * (no gold hover — see `.cursor/rules/global-button-system.mdc`). Pair with a trailing `CaretRight`
 * on forward-style actions where it fits.
 */
export const ADMIN_TOOLBAR_SECONDARY_ACTION_CLASS =
  "inline-flex items-center justify-center gap-1.5 min-h-[32px] px-3.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-[0.12em] leading-none [font-family:var(--font-body)] border-0 bg-transparent text-[var(--yugo-primary-text)] hover:bg-[color-mix(in_srgb,var(--yugo-primary-text)_9%,transparent)] active:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--yugo-primary-text)_22%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)] transition-[color,background-color,opacity,box-shadow] duration-150 disabled:opacity-50";

export const ADMIN_TOOLBAR_DESTRUCTIVE_ACTION_CLASS =
  "inline-flex items-center justify-center gap-1.5 min-h-[32px] px-3.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-[0.12em] leading-none [font-family:var(--font-body)] bg-[var(--red)] text-white hover:opacity-90 transition-all disabled:opacity-50";

export const ADMIN_TOOLBAR_PRIMARY_SOLID_CLASS =
  "inline-flex items-center justify-center gap-1.5 min-h-[32px] px-3.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-[0.12em] leading-none [font-family:var(--font-body)] bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] transition-all disabled:opacity-50";

/**
 * Premium wine fill, cream text, uppercase — text only (no leading/trailing icons).
 * Use for primary admin CTAs such as Mark delivered.
 */
export const ADMIN_PREMIUM_SOLID_CTA_CLASS =
  "inline-flex items-center justify-center min-h-[44px] px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-[0.12em] leading-none [font-family:var(--font-body)] bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--admin-primary-fill)_42%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] transition-[background-color,transform,opacity] duration-150 disabled:opacity-50";

/**
 * Borderless premium forward action (wine ink via `--yugo-primary-text`, soft wash). Optional icons.
 */
export const ADMIN_PREMIUM_TEXT_CTA_CLASS =
  "inline-flex items-center justify-center gap-1.5 min-h-[36px] px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-[0.12em] leading-none [font-family:var(--font-body)] bg-[color-mix(in_srgb,var(--yugo-primary-text)_10%,transparent)] text-[var(--yugo-primary-text)] hover:bg-[color-mix(in_srgb,var(--yugo-primary-text)_17%,transparent)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--yugo-primary-text)_24%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] transition-[background-color,transform,opacity] duration-150 disabled:opacity-50";

/** Modal / form cancel — text only, no border. */
export const ADMIN_PREMIUM_GHOST_CANCEL_CLASS =
  "inline-flex flex-1 items-center justify-center min-h-[44px] px-3 py-2.5 rounded-lg text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-[color-mix(in_srgb,var(--yugo-primary-text)_6%,transparent)] transition-colors";
