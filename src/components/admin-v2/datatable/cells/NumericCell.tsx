"use client"

import * as React from "react"
import { cn } from "../../lib/cn"

export type NumericCellProps = {
  value: number | null | undefined
  format?: (value: number) => string
  currency?: boolean
  precision?: number
  muted?: boolean
  className?: string
}

const defaultFormat = (
  value: number,
  { currency, precision = 0 }: { currency?: boolean; precision?: number },
) => {
  if (currency) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: precision,
      minimumFractionDigits: precision,
    }).format(value)
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: precision,
    minimumFractionDigits: precision,
  }).format(value)
}

export const NumericCell = ({
  value,
  format,
  currency,
  precision,
  muted,
  className,
}: NumericCellProps) => {
  if (value === null || value === undefined) {
    return <span className={cn("body-sm text-fg-subtle tabular-nums", className)}>–</span>
  }
  const display = format ? format(value) : defaultFormat(value, { currency, precision })
  return (
    <span
      className={cn(
        "body-sm tabular-nums font-medium",
        muted ? "text-fg-muted" : "text-fg",
        className,
      )}
    >
      {display}
    </span>
  )
}
