"use client"

import * as React from "react"
import { format as formatDate, differenceInHours, isToday, isValid } from "date-fns"
import { cn } from "../../lib/cn"

export type DateCellProps = {
  value: string | number | Date | null | undefined
  format?: string
  emphasizeRecent?: boolean
  className?: string
}

const normalize = (value: DateCellProps["value"]) => {
  if (value === null || value === undefined) return null
  const d =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value)
        : new Date(value)
  return isValid(d) ? d : null
}

export const DateCell = ({
  value,
  format = "MMM d, yyyy",
  emphasizeRecent = true,
  className,
}: DateCellProps) => {
  const date = normalize(value)
  if (!date) {
    return <span className={cn("body-sm text-fg-subtle", className)}>—</span>
  }
  const recent = emphasizeRecent
    ? isToday(date) || Math.abs(differenceInHours(new Date(), date)) < 24
    : false
  return (
    <span
      className={cn(
        "body-sm tabular-nums",
        recent ? "font-semibold text-fg" : "text-fg-muted",
        className,
      )}
    >
      {formatDate(date, format)}
    </span>
  )
}
