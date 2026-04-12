"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Info } from "@phosphor-icons/react";

/**
 * Global “i” control for secondary copy, disclaimers, and methodology notes.
 * Use next to headings or KPI rows — keep primary narrative visible; put long
 * explanatory text here. Hover/focus shows the panel; tap toggles (touch);
 * Escape and click-outside close.
 */
export type InfoHintVariant =
  | "default"
  /** @deprecated use `default` — same styling */
  | "partner"
  | "admin"
  /** Crew app (cream / wine accents) */
  | "crew"
  /** Dark band / hero (light text, dark panel) */
  | "inverse";

const panelStyles: Record<Exclude<InfoHintVariant, "partner">, string> = {
  default:
    "border-[#2C3E2D]/12 bg-[#FFFBF7] text-[#3D4540] shadow-[0_8px_24px_rgba(44,62,45,0.12)]",
  admin:
    "border-[var(--brd)] bg-[var(--card)] text-[var(--tx2)] shadow-lg",
  crew:
    "border-[#5C1A33]/15 bg-[#FFFBF7] text-[#3d2a26] shadow-[0_8px_24px_rgba(92,26,51,0.1)]",
  inverse:
    "border-white/20 bg-[#1a1f1b] text-[rgba(255,255,255,0.92)] shadow-xl",
};

const btnStyles: Record<Exclude<InfoHintVariant, "partner">, string> = {
  default:
    "text-[#5A6B5E] hover:text-[var(--tx)] focus-visible:ring-[#2C3E2D]/25",
  admin:
    "text-[var(--tx3)] hover:text-[var(--tx)] focus-visible:ring-[var(--admin-primary-fill)]/30",
  crew:
    "text-[#5C1A33]/70 hover:text-[#5C1A33] focus-visible:ring-[#5C1A33]/25",
  inverse:
    "text-white/75 hover:text-white focus-visible:ring-white/35",
};

function resolveVariant(v: InfoHintVariant): Exclude<InfoHintVariant, "partner"> {
  return v === "partner" ? "default" : v;
}

/** Horizontal alignment of the panel relative to the trigger. Default `start` avoids clipping when ancestors use `overflow-x-hidden` (centered panels extend left and get cut off). */
export type InfoHintAlign = "center" | "start" | "end";

export type InfoHintProps = {
  children: ReactNode;
  className?: string;
  buttonClassName?: string;
  ariaLabel?: string;
  variant?: InfoHintVariant;
  side?: "top" | "bottom";
  /** Icon size in px (default 16) */
  iconSize?: number;
  /** Panel horizontal alignment. Default `start` (left edge of trigger). Use `end` when the icon sits near the right edge; use `center` only when symmetry matters and overflow is not an issue. */
  align?: InfoHintAlign;
};

const alignPanelX: Record<InfoHintAlign, string> = {
  center: "left-1/2 -translate-x-1/2",
  start: "left-0 translate-x-0",
  end: "right-0 left-auto translate-x-0",
};

export function InfoHint({
  children,
  className,
  buttonClassName,
  ariaLabel = "More information",
  variant: variantProp = "default",
  side = "bottom",
  iconSize = 16,
  align = "start",
}: InfoHintProps) {
  const variant = resolveVariant(variantProp);
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [pinned, setPinned] = useState(false);
  const x = alignPanelX[align];
  const position =
    side === "top"
      ? `bottom-full ${x} mb-2`
      : `top-full ${x} mt-2`;

  const close = useCallback(() => setPinned(false), []);

  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned, close]);

  useEffect(() => {
    if (!pinned) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [pinned, close]);

  return (
    <span
      ref={wrapRef}
      className={`group relative inline-flex items-center align-middle ${className ?? ""}`}
    >
      <button
        type="button"
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 ${btnStyles[variant]} ${buttonClassName ?? ""}`}
        aria-describedby={id}
        aria-expanded={pinned}
        aria-label={ariaLabel}
        onClick={() => setPinned((p) => !p)}
      >
        <Info size={iconSize} weight="regular" />
      </button>
      <span
        id={id}
        role="tooltip"
        className={`absolute ${position} z-[80] w-[min(22rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] rounded-lg border p-3 text-[11px] leading-relaxed transition-opacity duration-150 ${panelStyles[variant]} ${
          pinned ? "pointer-events-auto" : "pointer-events-none"
        } ${
          pinned
            ? "visible opacity-100"
            : "invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
        }`}
      >
        {children}
      </span>
    </span>
  );
}
