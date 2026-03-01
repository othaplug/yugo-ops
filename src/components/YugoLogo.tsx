"use client";

interface YugoLogoProps {
  size?: number;
  className?: string;
}

/** YUGO wordmark — Instrument Serif, elegant standalone text */
export default function YugoLogo({ size = 16, className = "" }: YugoLogoProps) {
  return (
    <span
      className={`font-hero font-semibold text-[var(--gold)] select-none leading-none ${className}`}
      style={{ fontSize: size, letterSpacing: size >= 18 ? 4 : 3 }}
    >
      YUGO
    </span>
  );
}

/** Small "BETA" badge */
export function BetaBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-bold tracking-[2px] uppercase bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/25 ${className}`}>
      BETA
    </span>
  );
}
