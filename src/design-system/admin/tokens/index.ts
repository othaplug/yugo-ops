/**
 * Yugo+ admin v3 — design tokens (TS exports).
 * Values here mirror tokens.css. Keep in sync when editing either.
 */

export const theme = {
  color: {
    canvas: "var(--yu3-bg-canvas)",
    surface: "var(--yu3-bg-surface)",
    surfaceSunken: "var(--yu3-bg-surface-sunken)",
    surfaceRaised: "var(--yu3-bg-surface-raised)",
    overlay: "var(--yu3-bg-overlay)",
    glass: "var(--yu3-bg-glass)",
    lineSubtle: "var(--yu3-line-subtle)",
    line: "var(--yu3-line)",
    lineStrong: "var(--yu3-line-strong)",
    inkStrong: "var(--yu3-ink-strong)",
    ink: "var(--yu3-ink)",
    inkMuted: "var(--yu3-ink-muted)",
    inkFaint: "var(--yu3-ink-faint)",
    inkInverse: "var(--yu3-ink-inverse)",
    wine: "var(--yu3-wine)",
    wineHover: "var(--yu3-wine-hover)",
    winePress: "var(--yu3-wine-press)",
    wineTint: "var(--yu3-wine-tint)",
    wineWash: "var(--yu3-wine-wash)",
    onWine: "var(--yu3-on-wine)",
    forest: "var(--yu3-forest)",
    forestHover: "var(--yu3-forest-hover)",
    forestTint: "var(--yu3-forest-tint)",
    onForest: "var(--yu3-on-forest)",
    success: "var(--yu3-success)",
    successTint: "var(--yu3-success-tint)",
    warning: "var(--yu3-warning)",
    warningTint: "var(--yu3-warning-tint)",
    danger: "var(--yu3-danger)",
    dangerTint: "var(--yu3-danger-tint)",
    info: "var(--yu3-info)",
    infoTint: "var(--yu3-info-tint)",
    neutralTint: "var(--yu3-neutral-tint)",
  },
  radius: {
    xs: "var(--yu3-r-xs)",
    sm: "var(--yu3-r-sm)",
    md: "var(--yu3-r-md)",
    lg: "var(--yu3-r-lg)",
    xl: "var(--yu3-r-xl)",
    pill: "var(--yu3-r-pill)",
  },
  shadow: {
    sm: "var(--yu3-shadow-sm)",
    md: "var(--yu3-shadow-md)",
    lg: "var(--yu3-shadow-lg)",
  },
  space: (n: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12) =>
    `var(--yu3-sp-${n})`,
  motion: {
    easeOut: "var(--yu3-ease-out)",
    easeIo: "var(--yu3-ease-io)",
    dur1: "var(--yu3-dur-1)",
    dur2: "var(--yu3-dur-2)",
    dur3: "var(--yu3-dur-3)",
  },
} as const

export type Theme = typeof theme

export const chartStageColors = [
  "var(--yu3-c1)",
  "var(--yu3-c2)",
  "var(--yu3-c3)",
  "var(--yu3-c4)",
  "var(--yu3-c5)",
  "var(--yu3-c6)",
] as const

/** Resolved hex values (for chart libs that need raw strings). */
export const chartStageHex = [
  "#5c1a33",
  "#2c3e2d",
  "#a36208",
  "#2f4a7a",
  "#7a5e3a",
  "#7e2f5f",
] as const
