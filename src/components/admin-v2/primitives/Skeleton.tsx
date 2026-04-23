"use client"

import * as React from "react"
import { cn } from "../lib/cn"

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  width?: number | string
  height?: number | string
  radius?: "xs" | "sm" | "md" | "lg" | "full"
}

const radiusMap = {
  xs: "rounded-xs",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
} as const

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, style, width, height, radius = "sm", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "animate-pulse bg-surface-sunken",
        radiusMap[radius],
        className,
      )}
      style={{
        width: width,
        height: height,
        ...style,
      }}
      {...props}
    />
  ),
)
Skeleton.displayName = "Skeleton"
