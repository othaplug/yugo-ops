"use client"

import * as React from "react"
import { cn } from "../lib/cn"
import { Sparkline } from "../primitives/Sparkline"
import { TrendPill } from "../primitives/Badge"

export type SparkPanelItem = {
  id: string
  label: string
  value: string | number
  hint?: React.ReactNode
  trendPct?: number | null
  series?: number[]
  trend?: "up" | "down" | "flat"
  onClick?: () => void
}

export interface SparkPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  items: SparkPanelItem[]
  columns?: 2 | 3 | 4
  eyebrow?: string
  title?: string
  rightSlot?: React.ReactNode
}

export const SparkPanel = React.forwardRef<HTMLDivElement, SparkPanelProps>(
  ({ items, columns = 4, eyebrow, title, rightSlot, className, ...rest }, ref) => {
    const grid =
      columns === 4
        ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
        : columns === 3
          ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
          : "grid-cols-1 sm:grid-cols-2"
    return (
      <section
        ref={ref}
        className={cn("flex flex-col gap-3", className)}
        {...rest}
      >
        {(eyebrow || title || rightSlot) && (
          <header className="flex items-end justify-between gap-3">
            <div>
              {eyebrow ? (
                <div className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">
                  {eyebrow}
                </div>
              ) : null}
              {title ? (
                <h3 className="text-[15px] font-semibold text-[var(--yu3-ink-strong)] mt-0.5 leading-tight">
                  {title}
                </h3>
              ) : null}
            </div>
            {rightSlot}
          </header>
        )}
        <div className={cn("grid gap-3", grid)}>
          {items.map((item) => {
            const interactive = !!item.onClick
            const Tag: React.ElementType = interactive ? "button" : "div"
            return (
              <Tag
                key={item.id}
                onClick={item.onClick}
                className={cn(
                  "bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line-subtle)] rounded-[var(--yu3-r-lg)] p-4 flex flex-col gap-2 text-left",
                  interactive && "hover:border-[var(--yu3-line)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--yu3-wine)]",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">
                    {item.label}
                  </div>
                  {typeof item.trendPct === "number" ? (
                    <TrendPill delta={item.trendPct} />
                  ) : null}
                </div>
                <div className="flex items-end justify-between gap-3">
                  <div className="yu3-num text-[22px] font-semibold text-[var(--yu3-ink-strong)] leading-none">
                    {item.value}
                  </div>
                  {item.series && item.series.length > 1 ? (
                    <Sparkline
                      values={item.series}
                      width={112}
                      height={32}
                      trend={item.trend}
                    />
                  ) : null}
                </div>
                {item.hint ? (
                  <div className="text-[12px] text-[var(--yu3-ink-muted)] leading-tight">
                    {item.hint}
                  </div>
                ) : null}
              </Tag>
            )
          })}
        </div>
      </section>
    )
  },
)
SparkPanel.displayName = "SparkPanel"
