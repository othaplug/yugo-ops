"use client"

import * as React from "react"
import { cn } from "../lib/cn"
import { chartStageHex } from "../tokens"

export interface GaugeCardProps extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow?: string
  title?: string
  /** 0 to 1 */
  value: number
  valueLabel?: string | number
  valueHint?: React.ReactNode
  /** Segment data to color the arc as a donut. */
  segments?: { id: string; label: string; value: number; color?: string }[]
  rightSlot?: React.ReactNode
}

export const GaugeCard = React.forwardRef<HTMLDivElement, GaugeCardProps>(
  (
    {
      eyebrow,
      title,
      value,
      valueLabel,
      valueHint,
      segments,
      rightSlot,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    const pct = Math.min(1, Math.max(0, value))

    return (
      <div
        ref={ref}
        className={cn(
          "bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line-subtle)] rounded-[var(--yu3-r-lg)] p-5 flex flex-col gap-4",
          className,
        )}
        {...rest}
      >
        {(eyebrow || title || rightSlot) && (
          <header className="flex items-start justify-between gap-3">
            <div>
              {eyebrow ? (
                <div className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">
                  {eyebrow}
                </div>
              ) : null}
              {title ? (
                <div className="text-[15px] font-semibold text-[var(--yu3-ink-strong)] mt-1 leading-tight">
                  {title}
                </div>
              ) : null}
            </div>
            {rightSlot}
          </header>
        )}

        <div className="flex flex-col items-center gap-1">
          <GaugeArc pct={pct} segments={segments} />
          <div className="yu3-num text-[28px] font-semibold text-[var(--yu3-ink-strong)] leading-none">
            {valueLabel ?? `${Math.round(pct * 100)}%`}
          </div>
          {valueHint ? (
            <div className="text-[12px] text-[var(--yu3-ink-muted)] leading-tight text-center">
              {valueHint}
            </div>
          ) : null}
        </div>

        {children}
      </div>
    )
  },
)
GaugeCard.displayName = "GaugeCard"

function GaugeArc({
  pct,
  segments,
}: {
  pct: number
  segments?: { id: string; label: string; value: number; color?: string }[]
}) {
  const W = 220
  const H = 120
  const cx = W / 2
  const cy = H - 8
  const r = 92

  if (segments && segments.length > 0) {
    const total = segments.reduce((acc, s) => acc + s.value, 0) || 1
    let cursor = 0
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
        {segments.map((seg, i) => {
          const start = cursor / total
          cursor += seg.value
          const end = cursor / total
          const startAngle = Math.PI + start * Math.PI
          const endAngle = Math.PI + end * Math.PI
          const x1 = cx + Math.cos(startAngle) * r
          const y1 = cy + Math.sin(startAngle) * r
          const x2 = cx + Math.cos(endAngle) * r
          const y2 = cy + Math.sin(endAngle) * r
          const large = end - start > 0.5 ? 1 : 0
          const color = seg.color ?? chartStageHex[i % chartStageHex.length]
          return (
            <path
              key={seg.id}
              d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
              fill="none"
              stroke={color}
              strokeWidth={12}
              strokeLinecap="butt"
            />
          )
        })}
      </svg>
    )
  }

  const endAngle = Math.PI + pct * Math.PI
  const x2 = cx + Math.cos(endAngle) * r
  const y2 = cy + Math.sin(endAngle) * r
  const large = pct > 0.5 ? 1 : 0

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="var(--yu3-line-subtle)"
        strokeWidth={12}
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
        fill="none"
        stroke="var(--yu3-ink-strong)"
        strokeWidth={12}
        strokeLinecap="round"
      />
    </svg>
  )
}

export function BreakdownList({
  items,
  total,
  currency = false,
  className,
}: {
  items: { id: string; label: string; value: number; color?: string }[]
  total?: number
  currency?: boolean
  className?: string
}) {
  const sum = total ?? (items.reduce((a, i) => a + i.value, 0) || 1)
  return (
    <ul className={cn("flex flex-col divide-y divide-[var(--yu3-line-subtle)]", className)}>
      {items.map((it, i) => {
        const pct = it.value / sum
        const color = it.color ?? chartStageHex[i % chartStageHex.length]
        return (
          <li key={it.id} className="flex items-center gap-3 py-2">
            <span
              className="w-1.5 h-4 rounded-[2px] flex-none"
              style={{ background: color }}
            />
            <span className="text-[13px] text-[var(--yu3-ink)] flex-1 truncate">
              {it.label}
            </span>
            <span className="relative h-1.5 w-24 rounded-full bg-[var(--yu3-line-subtle)] overflow-hidden">
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${Math.max(3, pct * 100)}%`, background: color }}
              />
            </span>
            <span className="text-[12px] text-[var(--yu3-ink-muted)] yu3-num w-10 text-right">
              {Math.round(pct * 100)}%
            </span>
            <span className="text-[13px] font-medium text-[var(--yu3-ink-strong)] yu3-num w-20 text-right">
              {currency ? formatMoney(it.value) : it.value.toLocaleString()}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function formatMoney(n: number) {
  if (Math.abs(n) >= 1000) {
    return `$${(n / 1000).toFixed(1)}k`
  }
  return `$${n.toFixed(0)}`
}
