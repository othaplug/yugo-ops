"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/cn"

const avatarVariants = cva(
  "relative inline-flex items-center justify-center rounded-full bg-surface-sunken text-fg font-medium overflow-hidden select-none shrink-0",
  {
    variants: {
      size: {
        sm: "size-6 text-[10px]",
        md: "size-8 text-xs",
        lg: "size-10 text-sm",
      },
    },
    defaultVariants: { size: "md" },
  },
)

const statusDotVariants = cva(
  "absolute bottom-0 right-0 block rounded-full border-2 border-surface",
  {
    variants: {
      size: {
        sm: "size-2",
        md: "size-2.5",
        lg: "size-3",
      },
      tone: {
        success: "bg-graph-green",
        warning: "bg-warning",
        danger: "bg-graph-red",
        offline: "bg-fg-subtle",
      },
    },
    defaultVariants: { size: "md", tone: "success" },
  },
)

const initialsFor = (name?: string | null) => {
  if (!name) return ""
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

export type AvatarProps = VariantProps<typeof avatarVariants> & {
  src?: string | null
  name?: string | null
  alt?: string
  status?: "success" | "warning" | "danger" | "offline"
  className?: string
}

export const Avatar = ({ src, name, alt, size, status, className }: AvatarProps) => {
  const [errored, setErrored] = React.useState(false)
  const showImage = Boolean(src) && !errored
  return (
    <span className={cn(avatarVariants({ size }), className)}>
      {showImage ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src!}
          alt={alt ?? name ?? ""}
          className="size-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <span aria-hidden>{initialsFor(name)}</span>
      )}
      {status ? (
        <span
          aria-hidden
          className={cn(statusDotVariants({ size, tone: status }))}
        />
      ) : null}
    </span>
  )
}
