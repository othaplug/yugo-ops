"use client"

import * as React from "react"
import { cn } from "../lib/cn"

export type FloatingAction = {
  id: string
  label: string
  onClick: () => void
  destructive?: boolean
  disabled?: boolean
}

export type FloatingActionBarProps = {
  visible: boolean
  count: number
  countLabel: string
  actions: FloatingAction[]
  className?: string
}

export const FloatingActionBar = ({
  visible,
  count,
  countLabel,
  actions,
  className,
}: FloatingActionBarProps) => {
  if (!visible) return null
  return (
    <div
      role="region"
      aria-label={`${count} ${countLabel} selected`}
      className={cn(
        "pointer-events-auto fixed bottom-8 left-1/2 z-40 -translate-x-1/2",
        "flex h-12 items-center gap-0 rounded-full bg-fg/95 text-surface shadow-lg",
        "px-4 transition-all duration-200",
        "data-[state=hidden]:translate-y-4 data-[state=hidden]:opacity-0",
        "animate-in fade-in-0 slide-in-from-bottom-4",
        className,
      )}
    >
      <span className="body-sm font-medium px-2 tabular-nums">
        {count} {countLabel}
      </span>
      {actions.map((action, index) => (
        <React.Fragment key={action.id}>
          <span
            aria-hidden
            className="mx-1 h-4 w-px bg-surface/30"
          />
          <button
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
              "inline-flex h-8 items-center rounded-sm px-3 body-sm font-medium transition-colors outline-none",
              "hover:bg-surface/10",
              "focus-visible:bg-surface/10 focus-visible:ring-2 focus-visible:ring-surface/40",
              "disabled:opacity-50 disabled:pointer-events-none",
              action.destructive && "text-danger",
            )}
          >
            {action.label}
          </button>
          {/* gap after destructive or last is handled by parent */}
          {index /* noop */ === -1 ? null : null}
        </React.Fragment>
      ))}
    </div>
  )
}
