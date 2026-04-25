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

/** Yugo+ admin dark — neutral warm-charcoal canvas. Wine reserved for primary
 * CTAs + active nav indicators only (matches /docs/admin-consistency-audit.md). */
export function applyDocumentDarkTheme(): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.setAttribute("data-theme", "dark");
  el.classList.add("dark");
  el.style.colorScheme = "dark";
  const root = el.style;
  root.setProperty("--bg", "#0B0A09");
  root.setProperty("--bg2", "#131210");
  root.setProperty("--card", "#1A1816");
  root.setProperty("--tx", "#F6F3EE");
  root.setProperty("--tx2", "#C4BFB7");
  root.setProperty("--tx3", "#8A857D");
  root.setProperty("--brd", "rgba(255,248,240,0.08)");
  root.setProperty("--hover", "rgba(255,248,240,0.04)");
  root.setProperty("--gold", "#D8CFC1");
  root.setProperty("--gold2", "#EFE8DB");
  root.setProperty("--gdim", "rgba(255,248,240,0.06)");
  root.setProperty("--text-accent", "#D8CFC1");
  root.setProperty("--admin-primary-fill", "#8B1A3A");
  root.setProperty("--admin-primary-fill-hover", "#A32049");
  root.setProperty("--btn-text-on-accent", "#FCF8F5");
  root.setProperty("--grn", "#6DBF86");
  root.setProperty("--grdim", "rgba(42,74,53,0.18)");
  root.setProperty("--red", "#E87070");
  root.setProperty("--rdim", "rgba(163,45,45,0.14)");
  root.setProperty("--org", "#D39550");
  root.setProperty("--ordim", "rgba(180,100,20,0.1)");
  root.setProperty("--blue", "#7AA6E8");
  root.setProperty("--bldim", "rgba(107,159,232,0.1)");
  root.setProperty("--pur", "#B790F0");
  root.setProperty("--prdim", "rgba(183,144,240,0.1)");
}
