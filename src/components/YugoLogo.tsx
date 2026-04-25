"use client"

import Image from "next/image"
import { useContext } from "react"
import { ThemeContext } from "@/app/admin/components/ThemeContext"

export type LogoVariant = "gold" | "cream" | "black" | "wine" | "auto"

interface YugoLogoProps {
  size?: number
  className?: string
  variant?: LogoVariant
  useImage?: boolean
  onLightBackground?: boolean
  hidePlus?: boolean
  /** Wine-tile Y only, no ugo (collapsed nav, icon rail). */
  symbolOnly?: boolean
}

const LOGO_VERSION = "v2"

const LOGO_SRC: Record<Exclude<LogoVariant, "auto">, string> = {
  gold: `/images/yugo-logo-gold.png?${LOGO_VERSION}`,
  cream: `/images/yugo-logo-cream.png?${LOGO_VERSION}`,
  black: `/images/yugo-logo-black.png?${LOGO_VERSION}`,
  wine: `/images/yugo-logo-wine.png?${LOGO_VERSION}`,
}

/** App symbol; same mark as the favicon family. */
const YUGO_SYMBOL_SRC = `/yugo-symbol.png?${LOGO_VERSION}`

function PlusMark({ size, color }: { size: number; color: string }) {
  const plusSize = Math.max(8, Math.round(size * 0.52))
  return (
    <span
      style={{
        fontSize: plusSize,
        fontWeight: 800,
        lineHeight: 1,
        color,
        marginLeft: Math.max(1, Math.round(size * 0.06)),
        letterSpacing: 0,
        position: "relative",
        top: Math.round(size * -0.12),
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      +
    </span>
  )
}

/**
 * Yugo+ wordmark: full logotype from `yugo-logo-*.png`, optional +.
 * `symbolOnly`: favicon mark only; cream tint via CSS filter in dark / cream chrome.
 * `variant="auto"`: cream on dark admin, wine on light.
 */
export default function YugoLogo({
  size = 18,
  className = "",
  variant = "auto",
  useImage = true,
  onLightBackground: _onLightBackground = false,
  hidePlus = true,
  symbolOnly = false,
}: YugoLogoProps) {
  const themeCtx = useContext(ThemeContext)
  const resolvedVariant: Exclude<LogoVariant, "auto"> =
    variant === "auto"
      ? themeCtx?.theme === "dark"
        ? "cream"
        : "wine"
      : variant

  const plusColor =
    resolvedVariant === "cream"
      ? "#F5F0E8"
      : resolvedVariant === "black"
        ? "#1A1A1A"
        : resolvedVariant === "wine"
          ? "#5C1A33"
          : "#C9A962"

  if (symbolOnly) {
    /** Black PNG; invert/tint in cream chrome so the mark matches wordmark and labels */
    const creamSymbolOnDark =
      resolvedVariant === "cream"
        ? "invert(1) sepia(0.18) saturate(0.35) brightness(0.88)"
        : undefined
    return (
      <span
        role="img"
        aria-label="Yugo"
        className={className.trim()}
        style={{ display: "inline-flex", alignItems: "center" }}
      >
        <Image
          src={YUGO_SYMBOL_SRC}
          alt=""
          width={size}
          height={size}
          className="shrink-0 object-contain select-none"
          style={{
            height: size,
            width: "auto",
            filter: creamSymbolOnDark,
          }}
          unoptimized
          priority
        />
      </span>
    )
  }

  const src = LOGO_SRC[resolvedVariant]

  if (useImage && src) {
    return (
      <span
        role="img"
        aria-label="Yugo"
        className={className.trim()}
        style={{ display: "inline-flex", alignItems: "center" }}
      >
        <Image
          src={src}
          alt=""
          height={size}
          width={size * 4}
          className="shrink-0 select-none object-contain"
          style={{ height: size, width: "auto" }}
          unoptimized
          priority
        />
        {!hidePlus && <PlusMark size={size} color={plusColor} />}
      </span>
    )
  }

  const textColor =
    resolvedVariant === "cream"
      ? "#F5F0E8"
      : resolvedVariant === "black"
        ? "#1A1A1A"
        : resolvedVariant === "wine"
          ? "#5C1A33"
          : "var(--gold)"

  return (
    <span
      role="img"
      aria-label="Yugo"
      className={`font-hero font-bold select-none leading-none ${className}`}
      style={{
        fontSize: size,
        letterSpacing: size >= 18 ? 4 : 3,
        color: textColor,
        display: "inline-flex",
        alignItems: "baseline",
      }}
    >
      Yugo{!hidePlus && <PlusMark size={size} color={textColor} />}
    </span>
  )
}

export function BetaBadge({ className = "" }: { className?: string }) {
  const themeCtx = useContext(ThemeContext)
  const wineChrome = themeCtx?.theme === "dark"
  return (
    <span
      className={`text-[7px] font-semibold tracking-[1px] uppercase ${
        wineChrome
          ? "text-[var(--btn-text-on-accent)]/58"
          : "text-[var(--accent-text)]/50"
      } ${className}`}
    >
      BETA
    </span>
  )
}
