/**
 * Shared layout/chrome for admin detail toolbars (Edit / Download / Delete and similar rows).
 * Keeps secondary outlines and destructive solids aligned on height, radius, and type scale.
 */
export const ADMIN_TOOLBAR_SECONDARY_ACTION_CLASS =
  "inline-flex items-center justify-center gap-1.5 min-h-[30px] px-3 py-1.5 rounded-lg text-[10px] font-semibold border-2 border-[color-mix(in_srgb,var(--tx)_38%,transparent)] text-[var(--tx)] hover:bg-[color-mix(in_srgb,var(--tx)_10%,transparent)] hover:border-[color-mix(in_srgb,var(--gold)_55%,transparent)] hover:text-[var(--gold)] transition-all disabled:opacity-50";

export const ADMIN_TOOLBAR_DESTRUCTIVE_ACTION_CLASS =
  "inline-flex items-center justify-center gap-1.5 min-h-[30px] px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--red)] text-white hover:opacity-90 transition-all disabled:opacity-50";

export const ADMIN_TOOLBAR_PRIMARY_SOLID_CLASS =
  "inline-flex items-center justify-center gap-1.5 min-h-[30px] px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] transition-all disabled:opacity-50";
