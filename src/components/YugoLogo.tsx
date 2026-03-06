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
  hidePlus?: boolean;
}

const LOGO_VERSION = "v2";

const LOGO_SRC: Record<Exclude<LogoVariant, "auto">, string> = {
  gold: `/images/yugo-logo-gold.png?${LOGO_VERSION}`,
  cream: `/images/yugo-logo-cream.png?${LOGO_VERSION}`,
  black: `/images/yugo-logo-black.png?${LOGO_VERSION}`,
};

function PlusMark({ size, color }: { size: number; color: string }) {
  const plusSize = Math.max(8, Math.round(size * 0.52));
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
  );
}

/** YUGO+ logo — uses gold image on dark, gold text on light (most reliable) */
export default function YugoLogo({
  size = 18,
  className = "",
  variant = "auto",
  useImage = true,
  onLightBackground = false,
  hidePlus = false,
}: YugoLogoProps) {
  const themeContext = useContext(ThemeContext);
  const theme = themeContext?.theme ?? "dark";

  const isLight = theme === "light" || onLightBackground;

  if (isLight && variant === "auto") {
    return (
      <span
        className={`font-hero font-bold select-none leading-none ${className}`}
        style={{
          fontSize: size,
          letterSpacing: size >= 18 ? 4 : 3,
          color: "#B8962E",
          display: "inline-flex",
          alignItems: "baseline",
        }}
      >
        YUGO{!hidePlus && <PlusMark size={size} color="#B8962E" />}
      </span>
    );
  }

  const resolvedVariant: Exclude<LogoVariant, "auto"> =
    variant === "auto" ? (isLight ? "black" : "gold") : variant;

  const src = LOGO_SRC[resolvedVariant];

  const plusColor = resolvedVariant === "cream" ? "#F5F0E8" : resolvedVariant === "black" ? "#1A1A1A" : "#C9A962";

  if (useImage && src) {
    return (
      <span
        className={className.trim()}
        style={{ display: "inline-flex", alignItems: "center" }}
      >
        <Image
          src={src}
          alt="YUGO+"
          height={size}
          width={size * 4}
          className="select-none object-contain"
          style={{ height: size, width: "auto" }}
          unoptimized
          priority
        />
        {!hidePlus && <PlusMark size={size} color={plusColor} />}
      </span>
    );
  }

  const textColor = resolvedVariant === "cream" ? "#F5F0E8" : resolvedVariant === "black" ? "#1A1A1A" : "var(--gold)";

  return (
    <span
      className={`font-hero font-bold select-none leading-none ${className}`}
      style={{
        fontSize: size,
        letterSpacing: size >= 18 ? 4 : 3,
        color: textColor,
        display: "inline-flex",
        alignItems: "baseline",
      }}
    >
      YUGO{!hidePlus && <PlusMark size={size} color={textColor} />}
    </span>
  );
}

export function BetaBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`text-[7px] font-semibold tracking-[1px] uppercase text-[var(--gold)] opacity-50 ${className}`}>
      BETA
    </span>
  );
}
