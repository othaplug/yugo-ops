"use client"

import * as React from "react"
import { cn } from "../lib/cn"

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center gap-3 py-14 px-6",
        "rounded-[var(--yu3-r-lg)] border border-dashed border-[var(--yu3-line)]",
        "bg-[var(--yu3-bg-surface-sunken)]",
        className,
      )}
    >
      <div className="max-w-[420px]">
        <h3 className="text-[15px] font-semibold text-[var(--yu3-ink-strong)]">
          {title}
        </h3>
        {description ? (
          <p className="text-[13px] text-[var(--yu3-ink-muted)] mt-1 leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}
