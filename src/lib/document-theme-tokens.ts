/**
 * Applies theme to `document.documentElement` (class, data-theme, CSS variables).
 * Used by admin ThemeContext and by portals that must stay light-only (partner, crew).
 */

export function applyDocumentLightTheme(): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.setAttribute("data-theme", "light");
  el.classList.remove("dark");
  el.style.colorScheme = "light";
  const root = el.style;
  /* Mirror `globals.css` `[data-theme="light"]` + same keys as `applyDocumentDarkTheme` so toggling
   * does not leave dark inline vars (e.g. rose `--gold`) on the document root. */
  root.setProperty("--bg", "#FFFFFF");
  root.setProperty("--bg2", "#FFFFFF");
  root.setProperty("--card", "#FFFFFF");
  root.setProperty("--tx", "#141210");
  root.setProperty("--tx2", "#252220");
  root.setProperty("--tx3", "#3F3A36");
  root.setProperty("--brd", "#CBC4B8");
  root.setProperty("--hover", "#F5F3F0");
  root.setProperty("--gold", "#8C6E2F");
  root.setProperty("--gold2", "#7A5E25");
  root.setProperty("--gdim", "rgba(140, 110, 47, 0.1)");
  root.setProperty("--text-accent", "#8C6E2F");
  root.setProperty("--admin-primary-fill", "#8C6E2F");
  root.setProperty("--admin-primary-fill-hover", "#7A5E25");
  root.setProperty("--btn-text-on-accent", "#FFFFFF");
  root.setProperty("--grn", "#1D8A47");
  root.setProperty("--grdim", "rgba(29, 138, 71, 0.08)");
  root.setProperty("--red", "#B83030");
  root.setProperty("--rdim", "rgba(184, 48, 48, 0.1)");
  root.setProperty("--org", "#C27A14");
  root.setProperty("--ordim", "rgba(194, 122, 20, 0.1)");
  root.setProperty("--blue", "#2B5EC7");
  root.setProperty("--bldim", "rgba(43, 94, 199, 0.08)");
  root.setProperty("--pur", "#C9A962");
  root.setProperty("--prdim", "rgba(201, 169, 98, 0.08)");
}

/** Yugo+ admin dark — wine surfaces + accent (quote-adjacent). Login page is unchanged. */
export function applyDocumentDarkTheme(): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.setAttribute("data-theme", "dark");
  el.classList.add("dark");
  el.style.colorScheme = "dark";
  const root = el.style;
  root.setProperty("--bg", "#2B0416");
  root.setProperty("--bg2", "#3A0820");
  root.setProperty("--card", "#4A1428");
  root.setProperty("--tx", "#FCF8F5");
  root.setProperty("--tx2", "#E8D4DF");
  root.setProperty("--tx3", "#D4C4CF");
  root.setProperty("--brd", "rgba(139,26,58,0.32)");
  root.setProperty("--hover", "rgba(139,26,58,0.12)");
  /* Readable on wine: tabs, links, table accents — not same-hue-as-bg burgundy */
  root.setProperty("--gold", "#F0D0E3");
  root.setProperty("--gold2", "#FAF2F7");
  root.setProperty("--gdim", "rgba(252,236,244,0.16)");
  root.setProperty("--text-accent", "#F0D0E3");
  root.setProperty("--admin-primary-fill", "#6E2442");
  root.setProperty("--admin-primary-fill-hover", "#823052");
  root.setProperty("--btn-text-on-accent", "#FCF8F5");
  root.setProperty("--grn", "#6DBF86");
  root.setProperty("--grdim", "rgba(42,74,53,0.35)");
  root.setProperty("--red", "#E87070");
  root.setProperty("--rdim", "rgba(163,45,45,0.2)");
  root.setProperty("--org", "#B46414");
  root.setProperty("--ordim", "rgba(180,100,20,0.12)");
  root.setProperty("--blue", "#6B9FE8");
  root.setProperty("--bldim", "rgba(107,159,232,0.12)");
  root.setProperty("--pur", "#C084FC");
  root.setProperty("--prdim", "rgba(192,132,252,0.12)");
}
