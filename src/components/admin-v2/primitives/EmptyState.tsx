"use client"

import * as React from "react"
import { cn } from "../lib/cn"

type EmptyStateProps = {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export const EmptyState = ({
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
    <p className="heading-md text-fg max-w-[320px]">{title}</p>
    {description ? (
      <p className="mt-1 body-sm text-fg-muted max-w-[320px]">{description}</p>
    ) : null}
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
)
