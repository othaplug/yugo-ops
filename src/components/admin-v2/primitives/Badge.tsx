"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/cn"

const badgeVariants = cva(
  "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-sm px-1.5 text-[11px] font-medium tabular-nums",
  {
    variants: {
      tone: {
        neutral: "bg-surface-sunken text-fg-muted",
        accent: "bg-accent-subtle text-accent",
        danger: "bg-danger-bg text-danger",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
)

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ tone }), className)} {...props} />
  ),
)
Badge.displayName = "Badge"
