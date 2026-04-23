"use client"

import * as React from "react"
import { cn } from "../../lib/cn"
import type { SavedView } from "../types"

export type SavedViewsTabsProps = {
  views: SavedView[]
  activeId: string | null
  onSelect: (viewId: string | null) => void
  className?: string
}

export const SavedViewsTabs = ({
  views,
  activeId,
  onSelect,
  className,
}: SavedViewsTabsProps) => {
  const items = React.useMemo(
    () => [{ id: "__all__", label: "All" }, ...views],
    [views],
  )
  const resolvedActive = activeId ?? "__all__"

  return (
    <div
      role="tablist"
      aria-label="Saved views"
      className={cn(
        "flex items-center gap-1 border-b border-line overflow-x-auto",
        className,
      )}
    >
      {items.map((item) => {
        const isActive = resolvedActive === item.id
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(item.id === "__all__" ? null : item.id)}
            className={cn(
              "relative inline-flex h-9 items-center gap-1.5 px-3 body-sm transition-colors whitespace-nowrap",
              isActive
                ? "text-fg font-medium"
                : "text-fg-muted hover:text-fg",
            )}
          >
            {item.label}
            {isActive ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent"
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
