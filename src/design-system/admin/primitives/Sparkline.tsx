"use client"

import * as React from "react"

export interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  /** Force a trend (positive/negative color). Otherwise inferred from values. */
  trend?: "up" | "down" | "flat"
  /** CSS color for down trend. Defaults to `var(--yu3-danger)` (e.g. use `var(--yu3-wine)` for a maroon line). */
  downStroke?: string
  className?: string
  strokeWidth?: number
  ariaLabel?: string
}

function computeTrend(values: number[]): "up" | "down" | "flat" {
  if (values.length < 2) return "flat"
  const first = values[0]!
  const last = values[values.length - 1]!
  if (last > first * 1.02) return "up"
  if (last < first * 0.98) return "down"
  return "flat"
}

export function Sparkline({
  values,
  width = 96,
  height = 32,
  trend,
  downStroke = "var(--yu3-danger)",
  className,
  strokeWidth = 1.5,
  ariaLabel,
}: SparklineProps) {
  const padded = values.length > 1 ? values : [...values, ...values, ...values]
  const min = Math.min(...padded)
  const max = Math.max(...padded)
  const range = max - min || 1
  const t = trend || computeTrend(padded)
  const color =
    t === "up"
      ? "var(--yu3-success)"
      : t === "down"
        ? downStroke
        : "var(--yu3-ink-faint)"

  const pts = padded.map((v, i) => {
    const x = (i / (padded.length - 1)) * (width - 2) + 1
    const y = height - 1 - ((v - min) / range) * (height - 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const d = `M ${pts[0]} L ${pts.slice(1).join(" L ")}`
  const area = `${d} L ${width - 1},${height - 1} L 1,${height - 1} Z`
  const fillId = `yu3-spark-fill-${t}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role={ariaLabel ? "img" : "presentation"}
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${fillId})`} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ProbabilityBar({
  level,
  className,
}: {
  level: "low" | "mid" | "high"
  className?: string
}) {
  const bars = level === "high" ? 3 : level === "mid" ? 2 : 1
  const tone =
    level === "high"
      ? "var(--yu3-success)"
      : level === "mid"
        ? "var(--yu3-warning)"
        : "var(--yu3-danger)"
  const tint =
    level === "high"
      ? "var(--yu3-success-tint)"
      : level === "mid"
        ? "var(--yu3-warning-tint)"
        : "var(--yu3-danger-tint)"
  const label = level.toUpperCase()
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-[4px] px-1.5 h-[20px] text-[10px] font-bold uppercase tracking-[0.08em] leading-none " +
        (className ?? "")
      }
      style={{ background: tint, color: tone }}
    >
      <span className="inline-flex items-end gap-[2px] h-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-[3px] rounded-sm"
            style={{
              height: `${5 + i * 3}px`,
              background: i < bars ? tone : "currentColor",
              opacity: i < bars ? 1 : 0.25,
            }}
          />
        ))}
      </span>
      {label}
    </span>
  )
}
