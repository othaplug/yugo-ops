"use client"

import * as React from "react"
import { cn } from "../../lib/cn"

export type TextCellProps = {
  primary: React.ReactNode
  secondary?: React.ReactNode
  muted?: boolean
  className?: string
}

export const TextCell = ({
  primary,
  secondary,
  muted,
  className,
}: TextCellProps) => (
  <div className={cn("min-w-0", className)}>
    <p
      className={cn(
        "body-sm truncate",
        muted ? "text-fg-muted" : "text-fg font-medium",
      )}
    >
      {primary}
    </p>
    {secondary ? (
      <p className="body-xs text-fg-subtle truncate">{secondary}</p>
    ) : null}
  </div>
)
