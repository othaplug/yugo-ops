"use client"

import * as React from "react"
import { Avatar, type AvatarProps } from "./Avatar"
import { cn } from "../lib/cn"

type StackItem = Pick<AvatarProps, "src" | "name" | "alt">

export type AvatarStackProps = {
  items: StackItem[]
  size?: AvatarProps["size"]
  max?: number
  className?: string
}

const dimensionsFor = (size: AvatarProps["size"]) => {
  switch (size) {
    case "sm":
      return { ring: "ring-2 ring-surface", overlap: "-ml-1.5", pillSize: "h-6 px-1.5 text-[10px]" }
    case "lg":
      return { ring: "ring-2 ring-surface", overlap: "-ml-2", pillSize: "h-10 px-2.5 text-sm" }
    default:
      return { ring: "ring-2 ring-surface", overlap: "-ml-1.5", pillSize: "h-8 px-2 text-xs" }
  }
}

export const AvatarStack = ({ items, size = "md", max = 3, className }: AvatarStackProps) => {
  const visible = items.slice(0, max)
  const overflow = items.length - visible.length
  const { ring, overlap, pillSize } = dimensionsFor(size)

  return (
    <div className={cn("flex items-center", className)}>
      {visible.map((item, index) => (
        <Avatar
          key={`${item.name ?? "avatar"}-${index}`}
          size={size}
          src={item.src}
          name={item.name}
          alt={item.alt}
          className={cn(ring, index > 0 && overlap)}
        />
      ))}
      {overflow > 0 ? (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-surface-sunken text-fg font-medium",
            pillSize,
            ring,
            overlap,
          )}
          aria-label={`${overflow} more`}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  )
}
