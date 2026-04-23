"use client"

import * as React from "react"
import { cn } from "../../lib/cn"

export type ProgressCellProps = {
  value: number // 0 - 100
  thresholds?: { warn: number; danger: number }
  showLabel?: boolean
  className?: string
}

export const ProgressCell = ({
  value,
  thresholds = { warn: 66, danger: 33 },
  showLabel = true,
  className,
}: ProgressCellProps) => {
  const clamped = Math.max(0, Math.min(100, value))
  const tone =
    clamped >= thresholds.warn
      ? "bg-graph-green"
      : clamped >= thresholds.danger
        ? "bg-warning"
        : "bg-graph-red"

  return (
    <div className={cn("flex min-w-[120px] items-center gap-2", className)}>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
        <div
          className={cn("h-full rounded-full transition-all", tone)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel ? (
        <span className="body-xs tabular-nums text-fg-muted w-9 text-right">
          {Math.round(clamped)}%
        </span>
      ) : null}
    </div>
  )
}
