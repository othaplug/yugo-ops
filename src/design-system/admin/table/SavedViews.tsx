"use client"

import * as React from "react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../primitives/DropdownMenu"
import { Button } from "../primitives/Button"
import { Input } from "../primitives/Input"
import { CaretDown, Plus, FloppyDisk, Trash } from "../icons"
import type { SavedView } from "./types"
import { cn } from "../lib/cn"

export interface SavedViewsProps {
  views: SavedView[]
  activeId?: string | null
  onSelect: (id: string) => void
  onSave: (name: string) => void
  onDelete?: (id: string) => void
}

export function SavedViews({
  views,
  activeId,
  onSelect,
  onSave,
  onDelete,
}: SavedViewsProps) {
  const [newName, setNewName] = React.useState("")
  const [creating, setCreating] = React.useState(false)
  const active = views.find((v) => v.id === activeId)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-1 font-medium",
            active
              ? "text-[var(--yu3-ink-strong)]"
              : "text-[var(--yu3-ink-muted)]",
          )}
          trailingIcon={<CaretDown size={12} />}
        >
          {active ? active.name : "All records"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[240px]">
        <DropdownMenuLabel>Saved views</DropdownMenuLabel>
        {views.length === 0 ? (
          <div className="px-2 py-2 text-[12px] text-[var(--yu3-ink-muted)]">
            No saved views yet.
          </div>
        ) : (
          views.map((v) => (
            <DropdownMenuItem
              key={v.id}
              onSelect={() => onSelect(v.id)}
              className="justify-between"
            >
              <span className={cn(v.id === activeId && "font-semibold text-[var(--yu3-wine)]")}>
                {v.name}
              </span>
              {onDelete ? (
                <button
                  type="button"
                  aria-label={`Delete view ${v.name}`}
                  className="text-[var(--yu3-ink-faint)] hover:text-[var(--yu3-danger)] p-0.5"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(v.id)
                  }}
                >
                  <Trash size={12} />
                </button>
              ) : null}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        {creating ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!newName.trim()) return
              onSave(newName.trim())
              setNewName("")
              setCreating(false)
            }}
            className="flex items-center gap-1 p-1"
          >
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="View name"
              className="h-8"
            />
            <Button type="submit" size="sm" variant="primary">
              Save
            </Button>
          </form>
        ) : (
          <DropdownMenuItem
            icon={<FloppyDisk size={13} />}
            onSelect={(e) => {
              e.preventDefault()
              setCreating(true)
            }}
          >
            Save current view…
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
