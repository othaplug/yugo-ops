"use client"

import * as React from "react"
import { cn } from "../lib/cn"

type EmptyStateProps = {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center py-12 text-center",
      className,
    )}
  >
    {icon ? (
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-surface-subtle text-fg-muted">
        {icon}
      </div>
    ) : null}
    <p className="heading-md text-fg max-w-[320px]">{title}</p>
    {description ? (
      <p className="mt-1 body-sm text-fg-muted max-w-[320px]">{description}</p>
    ) : null}
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
)
