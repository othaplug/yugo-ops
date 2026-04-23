"use client"

import * as React from "react"
import { Chip, type ChipVariant } from "../primitives/Chip"
import { cn } from "../lib/cn"

export type IndicatorLevel = "high" | "mid" | "low"

const levelConfig: Record<
  IndicatorLevel,
  { active: number; variant: ChipVariant; label: string }
> = {
  high: { active: 3, variant: "success", label: "HIGH" },
  mid: { active: 2, variant: "warning", label: "MID" },
  low: { active: 1, variant: "danger", label: "LOW" },
}

const toneBarClass: Record<IndicatorLevel, string> = {
  high: "bg-graph-green",
  mid: "bg-warning",
  low: "bg-graph-red",
}

export type IndicatorBarsProps = {
  level: IndicatorLevel
  label?: string
  className?: string
  hideChip?: boolean
}

export const IndicatorBars = ({
  level,
  label,
  className,
  hideChip,
}: IndicatorBarsProps) => {
  const config = levelConfig[level]
  const bars = [1, 2, 3].map((idx) => {
    const isActive = idx <= config.active
    return (
      <span
        key={idx}
        aria-hidden
        className={cn(
          "block w-[3px] rounded-[1px]",
          idx === 1 ? "h-2" : idx === 2 ? "h-3" : "h-4",
          isActive ? toneBarClass[level] : "bg-line-strong",
        )}
      />
    )
  })
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="inline-flex items-end gap-[2px]" aria-hidden>
        {bars}
      </span>
      {hideChip ? null : (
        <Chip label={label ?? config.label} variant={config.variant} />
      )}
    </span>
  )
}
