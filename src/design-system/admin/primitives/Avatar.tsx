"use client"

import * as React from "react"
import { cn } from "../lib/cn"

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name?: string | null
  src?: string | null
  size?: 20 | 24 | 28 | 32 | 36 | 40 | 48
}

function initials(name?: string | null) {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
}

function hue(name?: string | null) {
  if (!name) return 0
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return h
}

export const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  ({ className, name, src, size = 28, ...rest }, ref) => {
    const h = hue(name)
    const bg = `hsl(${h} 38% 92%)`
    const fg = `hsl(${h} 36% 28%)`
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-full overflow-hidden select-none font-semibold",
          className,
        )}
        style={{
          width: size,
          height: size,
          fontSize: Math.max(10, Math.floor(size * 0.38)),
          background: src ? undefined : bg,
          color: fg,
        }}
        {...rest}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name || "avatar"}
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{initials(name)}</span>
        )}
      </span>
    )
  },
)
Avatar.displayName = "Avatar"

export interface AvatarStackProps {
  items: { name?: string | null; src?: string | null }[]
  max?: number
  size?: AvatarProps["size"]
  className?: string
}
export function AvatarStack({
  items,
  max = 3,
  size = 24,
  className,
}: AvatarStackProps) {
  const visible = items.slice(0, max)
  const overflow = items.length - visible.length
  return (
    <span className={cn("inline-flex items-center", className)}>
      {visible.map((item, i) => (
        <Avatar
          key={i}
          name={item.name}
          src={item.src}
          size={size}
          className="ring-2 ring-[var(--yu3-bg-surface)]"
          style={{ marginLeft: i === 0 ? 0 : -8 }}
        />
      ))}
      {overflow > 0 ? (
        <span
          className="inline-flex items-center justify-center rounded-full ring-2 ring-[var(--yu3-bg-surface)] bg-[var(--yu3-neutral-tint)] text-[var(--yu3-ink-muted)] font-semibold yu3-num"
          style={{
            width: size,
            height: size,
            fontSize: Math.max(10, Math.floor(size * 0.38)),
            marginLeft: -8,
          }}
        >
          +{overflow}
        </span>
      ) : null}
    </span>
  )
}
