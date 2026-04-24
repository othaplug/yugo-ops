"use client"

import * as React from "react"
import { cn } from "../lib/cn"

export function Skeleton({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--yu3-r-sm)] bg-[var(--yu3-bg-surface-sunken)]",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:bg-gradient-to-r before:from-transparent before:via-[color-mix(in_srgb,var(--yu3-ink)_4%,transparent)] before:to-transparent",
        "before:animate-[yu3-shimmer_1.4s_ease-in-out_infinite]",
        className,
      )}
      {...rest}
    />
  )
}
