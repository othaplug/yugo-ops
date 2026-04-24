"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/cn"

/**
 * Badge — low-saturation filled pill for tonal signals (e.g. counts, neutral chips).
 * Use `StatusPill` for tracked uppercase status chips in tables.
 */
const badgeStyles = cva(
  "inline-flex items-center gap-1 font-medium rounded-[var(--yu3-r-pill)] whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral:
          "bg-[var(--yu3-neutral-tint)] text-[var(--yu3-ink)]",
        wine:
          "bg-[var(--yu3-wine-tint)] text-[var(--yu3-wine)]",
        forest:
          "bg-[var(--yu3-forest-tint)] text-[var(--yu3-forest)]",
        success:
          "bg-[var(--yu3-success-tint)] text-[var(--yu3-success)]",
        warning:
          "bg-[var(--yu3-warning-tint)] text-[var(--yu3-warning)]",
        danger:
          "bg-[var(--yu3-danger-tint)] text-[var(--yu3-danger)]",
        info:
          "bg-[var(--yu3-info-tint)] text-[var(--yu3-info)]",
        outline:
          "bg-transparent text-[var(--yu3-ink-muted)] border border-[var(--yu3-line)]",
      },
      size: {
        sm: "h-5 px-2 text-[11px]",
        md: "h-6 px-2.5 text-[12px]",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "md",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeStyles> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, ...rest }, ref) => (
    <span
      ref={ref}
      className={cn(badgeStyles({ variant, size }), className)}
      {...rest}
    />
  ),
)
Badge.displayName = "Badge"

/**
 * StatusPill — uppercase tracked 11px, 4px radius. Used in DataTable cells
 * for Status, Source, Type columns. Matches Meetalo reference.
 */
const pillStyles = cva(
  "inline-flex items-center gap-1 uppercase tracking-[0.08em] font-bold rounded-[4px] px-1.5 h-[20px] text-[10px] leading-none whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-[var(--yu3-neutral-tint)] text-[var(--yu3-ink)]",
        wine: "bg-[var(--yu3-wine-tint)] text-[var(--yu3-wine)]",
        forest: "bg-[var(--yu3-forest-tint)] text-[var(--yu3-forest)]",
        success: "bg-[var(--yu3-success-tint)] text-[var(--yu3-success)]",
        warning: "bg-[var(--yu3-warning-tint)] text-[var(--yu3-warning)]",
        danger: "bg-[var(--yu3-danger-tint)] text-[var(--yu3-danger)]",
        info: "bg-[var(--yu3-info-tint)] text-[var(--yu3-info)]",
        pre:
          "bg-[color-mix(in_srgb,var(--yu3-warning)_14%,transparent)] text-[var(--yu3-warning)]",
        new: "bg-[color-mix(in_srgb,var(--yu3-info)_14%,transparent)] text-[var(--yu3-info)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
)

export interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pillStyles> {
  dot?: boolean
}

export const StatusPill = React.forwardRef<HTMLSpanElement, StatusPillProps>(
  ({ className, tone, dot, children, ...rest }, ref) => (
    <span
      ref={ref}
      className={cn(pillStyles({ tone }), className)}
      {...rest}
    >
      {dot ? (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current inline-block"
          aria-hidden
        />
      ) : null}
      {children}
    </span>
  ),
)
StatusPill.displayName = "StatusPill"

/**
 * TrendPill — small arrow+percent chip used on KPIs. Matches Meetalo `+24% ↗`.
 */
export function TrendPill({
  delta,
  className,
  format = "percent",
}: {
  delta: number
  className?: string
  format?: "percent" | "value"
}) {
  const up = delta > 0
  const down = delta < 0
  const tone = up ? "success" : down ? "danger" : "neutral"
  const formatted =
    format === "percent"
      ? `${up ? "+" : ""}${Number.isFinite(delta) ? Math.round(delta) : 0}%`
      : `${up ? "+" : ""}${delta}`
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold rounded-[var(--yu3-r-pill)] px-1.5 h-[20px] text-[11px] leading-none whitespace-nowrap yu3-num",
        pillToneClass(tone),
        className,
      )}
    >
      <TrendArrow up={up} down={down} />
      {formatted}
    </span>
  )
}

function TrendArrow({ up, down }: { up: boolean; down: boolean }) {
  const path = up
    ? "M3 10 L7 6 L10 9 L13 6 M13 6 L13 9 M13 6 L10 6"
    : down
      ? "M3 6 L7 10 L10 7 L13 10 M13 10 L13 7 M13 10 L10 10"
      : "M3 8 L13 8"
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  )
}

function pillToneClass(tone: "success" | "danger" | "neutral") {
  if (tone === "success") return "bg-[var(--yu3-success-tint)] text-[var(--yu3-success)]"
  if (tone === "danger") return "bg-[var(--yu3-danger-tint)] text-[var(--yu3-danger)]"
  return "bg-[var(--yu3-neutral-tint)] text-[var(--yu3-ink-muted)]"
}
