"use client"

import * as React from "react"
import { cn } from "../lib/cn"
import { Button } from "../primitives/Button"
import { X } from "../icons"
import type { BulkAction } from "./types"

export interface BulkBarProps<Row> {
  selectedCount: number
  totalCount: number
  actions: BulkAction<Row>[]
  rows: Row[]
  onClear: () => void
}

export function BulkBar<Row>({
  selectedCount,
  totalCount,
  actions,
  rows,
  onClear,
}: BulkBarProps<Row>) {
  if (selectedCount === 0) return null
  return (
    <div
      className={cn(
        "fixed left-1/2 -translate-x-1/2 z-[var(--yu3-z-drawer)]",
        "bottom-[calc(var(--yu3-mobile-navbar-h)+var(--yu3-sp-3))] lg:bottom-6",
        "rounded-[var(--yu3-r-xl)] shadow-[var(--yu3-shadow-lg)]",
        "bg-[var(--yu3-ink-strong)] text-[var(--yu3-ink-inverse)]",
        "px-2 py-2 flex items-center gap-2",
        "border border-[var(--yu3-ink-strong)]",
        "animate-[yu3-slide-up_var(--yu3-dur-2)_var(--yu3-ease-out)]",
      )}
      role="toolbar"
      aria-label="Bulk actions"
    >
      <div className="flex items-center gap-2 px-3">
        <span className="inline-flex items-center justify-center h-5 w-5 rounded-[var(--yu3-r-xs)] bg-[color-mix(in_srgb,white_18%,transparent)] text-[11px] font-bold yu3-num">
          {selectedCount}
        </span>
        <span className="text-[12px] font-medium">
          selected
          {totalCount > 0 ? (
            <span className="text-[var(--yu3-ink-faint)] ml-1 font-normal">
              of {totalCount}
            </span>
          ) : null}
        </span>
      </div>
      <div className="h-5 w-px bg-[color-mix(in_srgb,white_14%,transparent)]" />
      <div className="flex items-center gap-1">
        {actions.map((action) => {
          const disabled = action.disabled?.(rows) || false
          return (
            <Button
              key={action.id}
              variant="ghost"
              size="sm"
              onClick={() => action.run(rows)}
              disabled={disabled}
              className={cn(
                "text-[var(--yu3-ink-inverse)] hover:bg-[color-mix(in_srgb,white_10%,transparent)] hover:text-[var(--yu3-ink-inverse)]",
                action.danger && "text-[#ffb0a8] hover:text-[#ffd2cc]",
              )}
              leadingIcon={action.icon}
            >
              {action.label}
            </Button>
          )
        })}
      </div>
      <div className="h-5 w-px bg-[color-mix(in_srgb,white_14%,transparent)]" />
      <button
        type="button"
        onClick={onClear}
        className="inline-flex items-center gap-1 h-7 px-2 rounded-[var(--yu3-r-sm)] text-[11px] text-[var(--yu3-ink-faint)] hover:bg-[color-mix(in_srgb,white_10%,transparent)] hover:text-[var(--yu3-ink-inverse)]"
        aria-label="Clear selection"
      >
        <X size={12} />
        Clear
      </button>
    </div>
  )
}
