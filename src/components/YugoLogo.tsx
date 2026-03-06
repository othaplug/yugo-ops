"use client";

import Image from "next/image";
import { useContext } from "react";
import { ThemeContext } from "@/app/admin/components/ThemeContext";

export type LogoVariant = "gold" | "cream" | "black" | "auto";

interface YugoLogoProps {
  size?: number;
  className?: string;
  variant?: LogoVariant;
  useImage?: boolean;
  onLightBackground?: boolean;
}

const LOGO_VERSION = "v2";

const LOGO_SRC: Record<Exclude<LogoVariant, "auto">, string> = {
  gold: `/images/yugo-logo-gold.png?${LOGO_VERSION}`,
  cream: `/images/yugo-logo-cream.png?${LOGO_VERSION}`,
  black: `/images/yugo-logo-black.png?${LOGO_VERSION}`,
};

/** YUGO logo — uses gold image on dark, gold text on light (most reliable) */
export default function YugoLogo({
  size = 18,
  className = "",
  variant = "auto",
  useImage = true,
  onLightBackground = false,
}: YugoLogoProps) {
  const themeContext = useContext(ThemeContext);
  const theme = themeContext?.theme ?? "dark";

  const isLight = theme === "light" || onLightBackground;

  // On light backgrounds with auto variant, use styled text (cache-proof)
  if (isLight && variant === "auto") {
    return (
      <span
        className={`font-hero font-bold select-none leading-none ${className}`}
        style={{
          fontSize: size,
          letterSpacing: size >= 18 ? 4 : 3,
          color: "#B8962E",
        }}
      >
        YUGO
      </span>
    );
  }

  const resolvedVariant: Exclude<LogoVariant, "auto"> =
    variant === "auto" ? (isLight ? "black" : "gold") : variant;

  const src = LOGO_SRC[resolvedVariant];

  if (useImage && src) {
    return (
      <span
        className={className.trim()}
        style={{ display: "inline-block" }}
      >
        <Image
          src={src}
          alt="YUGO"
          height={size}
          width={size * 4}
          className="select-none object-contain"
          style={{ height: size, width: "auto" }}
          unoptimized
          priority
        />
      </span>
    );
  }

  return (
    <span
      className={`font-hero font-bold select-none leading-none ${className}`}
      style={{
        fontSize: size,
        letterSpacing: size >= 18 ? 4 : 3,
        color: "var(--gold)",
      }}
    >
      YUGO
    </span>
  );
}

/** Small "BETA" badge — position unchanged to the right of the logo */
export function BetaBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-micro font-bold tracking-[2px] uppercase bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/25 ${className}`}>
      BETA
    </span>
  );
}
