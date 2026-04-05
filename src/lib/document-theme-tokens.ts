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
  root.setProperty("--bg", "#FAF8F5");
  root.setProperty("--bg2", "#F5F3F0");
  root.setProperty("--card", "#FFFFFF");
  root.setProperty("--tx", "#1A1A1A");
  root.setProperty("--tx2", "#333333");
  root.setProperty("--tx3", "#524D47");
  root.setProperty("--brd", "#E8E4DF");
  root.setProperty("--gdim", "rgba(201,169,98,0.2)");
  root.setProperty("--btn-text-on-accent", "#FFFFFF");
  root.setProperty("--gold2", "#B89A52");
}

export function applyDocumentDarkTheme(): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.setAttribute("data-theme", "dark");
  el.classList.add("dark");
  el.style.colorScheme = "dark";
  const root = el.style;
  root.setProperty("--bg", "#0F0F0F");
  root.setProperty("--bg2", "#1A1A1A");
  root.setProperty("--card", "#1E1E1E");
  root.setProperty("--tx", "#E8E5E0");
  root.setProperty("--tx2", "#999");
  root.setProperty("--tx3", "#666");
  root.setProperty("--brd", "#2A2A2A");
  root.setProperty("--btn-text-on-accent", "#FFFFFF");
  root.setProperty("--gold2", "#B89A52");
}
