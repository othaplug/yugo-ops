"use client"

import * as React from "react"
import type { Icon as PhIcon } from "@phosphor-icons/react"
import type { ViewMode } from "./types"
import { cn } from "../lib/cn"
import { List, ChartBar, SquaresFour } from "@phosphor-icons/react"

export interface ViewSwitcherProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  /** Which views are available (default: all). */
  available?: ViewMode[]
}

const DEFINITIONS: { mode: ViewMode; label: string; Icon: PhIcon }[] = [
  { mode: "list", label: "List", Icon: List },
  { mode: "board", label: "Board", Icon: SquaresFour },
  { mode: "pipeline", label: "Pipeline", Icon: ChartBar },
]

export function ViewSwitcher({
  value,
  onChange,
  available = ["list", "board", "pipeline"],
}: ViewSwitcherProps) {
  const items = DEFINITIONS.filter((d) => available.includes(d.mode))
  return (
    <div
      role="tablist"
      aria-label="View"
      className="inline-flex items-center bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line)] rounded-[var(--yu3-r-md)] p-0.5"
    >
      {items.map((def) => {
        const active = def.mode === value
        return (
          <button
            key={def.mode}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(def.mode)}
            className={cn(
              "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[var(--yu3-r-sm)] text-[12px] font-medium transition-colors",
              active
                ? "bg-[var(--yu3-wine-wash)] text-[var(--yu3-wine)]"
                : "text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-ink)] hover:bg-[var(--yu3-bg-surface-sunken)]",
            )}
          >
            <def.Icon size={12} weight="regular" />
            <span>{def.label}</span>
          </button>
        )
      })}
    </div>
  )
}
