"use client";

import Image from "next/image";
import { useContext } from "react";
import { ThemeContext } from "@/app/admin/components/ThemeContext";

export type LogoVariant = "gold" | "cream" | "black" | "auto";

interface YugoLogoProps {
  /** Height in pixels. Matches original text logo (e.g. 18). */
  size?: number;
  className?: string;
  /** Logo variant. "auto" = dark theme → gold, light → black. */
  variant?: LogoVariant;
  /** Use image logo (default true). Set false to render text fallback. */
  useImage?: boolean;
  /** Set true when logo is on a light background so blend mode is not applied (gold/cream stay visible). */
  onLightBackground?: boolean;
}

const LOGO_SRC: Record<Exclude<LogoVariant, "auto">, string> = {
  gold: "/images/yugo-logo-gold.png",
  cream: "/images/yugo-logo-cream.png",
  black: "/images/yugo-logo-black.png",
};

/** YUGO logo — image (or text fallback) with theme-aware variant */
export default function YugoLogo({
  size = 18,
  className = "",
  variant = "auto",
  useImage = true,
  onLightBackground = false,
}: YugoLogoProps) {
  const themeContext = useContext(ThemeContext);
  const theme = themeContext?.theme ?? "dark";
  const resolvedVariant: Exclude<LogoVariant, "auto"> =
    variant === "auto" ? (theme === "dark" ? "gold" : "black") : variant;
  const src = LOGO_SRC[resolvedVariant];
  const isDarkBgLogo = (resolvedVariant === "gold" || resolvedVariant === "cream") && !onLightBackground;

  // On light backgrounds use gold text logo (no image) so it's always gold with no black background
  if (onLightBackground) {
    return (
      <span
        className={`font-hero font-semibold select-none leading-none ${className}`}
        style={{ fontSize: size, letterSpacing: size >= 18 ? 4 : 3, color: "#B8962E" }}
      >
        YUGO
      </span>
    );
  }

  if (useImage && src) {
    const blendMode = isDarkBgLogo ? "lighten" : undefined;
    return (
      <span
        className={className.trim()}
        style={{ background: "transparent", display: "inline-block" }}
      >
        <Image
          src={src}
          alt="YUGO"
          height={size}
          width={size * 4}
          className="select-none object-contain yugo-logo-no-bg"
          style={{
            height: size,
            width: "auto",
            background: "transparent",
            ...(blendMode && { mixBlendMode: blendMode }),
          }}
          unoptimized
          priority
        />
      </span>
    );
  }

  return (
    <span
      className={`font-hero font-semibold text-[var(--gold)] select-none leading-none ${className}`}
      style={{ fontSize: size, letterSpacing: size >= 18 ? 4 : 3 }}
    >
      YUGO
    </span>
  );
}

/** Small "BETA" badge — position unchanged to the right of the logo */
export function BetaBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-bold tracking-[2px] uppercase bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/25 ${className}`}>
      BETA
    </span>
  );
}
