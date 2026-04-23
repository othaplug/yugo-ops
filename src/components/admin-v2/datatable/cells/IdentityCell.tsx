"use client"

import * as React from "react"
import { Avatar, type AvatarProps } from "../../primitives/Avatar"
import { cn } from "../../lib/cn"

export type IdentityCellProps = {
  primary: string
  secondary?: string | null
  avatar?: Pick<AvatarProps, "src" | "name" | "alt">
  size?: AvatarProps["size"]
  className?: string
}

export const IdentityCell = ({
  primary,
  secondary,
  avatar,
  size = "md",
  className,
}: IdentityCellProps) => (
  <div className={cn("flex min-w-0 items-center gap-3", className)}>
    <Avatar
      name={avatar?.name ?? primary}
      src={avatar?.src ?? undefined}
      alt={avatar?.alt}
      size={size}
    />
    <div className="min-w-0 flex-1">
      <p className="body-sm font-medium text-fg truncate">{primary}</p>
      {secondary ? (
        <p className="body-xs text-fg-subtle truncate">{secondary}</p>
      ) : null}
    </div>
  </div>
)
