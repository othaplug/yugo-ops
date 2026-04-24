"use client"

import * as React from "react"
import { Command as CmdK } from "cmdk"
import { useRouter } from "next/navigation"
import { cn } from "../lib/cn"
import { SIDEBAR_SECTIONS, QUICK_ACTIONS } from "./nav"
import {
  MagnifyingGlass,
  Plus,
  Sparkle,
  Clock,
  ArrowRight,
} from "../icons"
import { Dialog, DialogContent, DialogOverlay } from "@radix-ui/react-dialog"

export interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recent?: { label: string; href: string; subtitle?: string }[]
}

export function CommandPalette({
  open,
  onOpenChange,
  recent = [],
}: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = React.useState("")

  const navigate = (href: string) => {
    onOpenChange(false)
    setQuery("")
    router.push(href)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay
        className={cn(
          "fixed inset-0 z-[var(--yu3-z-palette)] bg-[var(--yu3-bg-overlay)] backdrop-blur-[2px]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        )}
      />
      <DialogContent
        className={cn(
          "fixed left-1/2 top-[12%] -translate-x-1/2 z-[var(--yu3-z-palette)]",
          "w-[calc(100vw-2rem)] max-w-[640px] outline-none",
        )}
        aria-describedby={undefined}
        onEscapeKeyDown={() => onOpenChange(false)}
        onPointerDownOutside={() => onOpenChange(false)}
      >
        <CmdK
          label="Search"
          className={cn(
            "w-full bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line)]",
            "rounded-[var(--yu3-r-xl)] shadow-[var(--yu3-shadow-lg)] overflow-hidden",
          )}
          value={undefined}
          onKeyDown={(e) => {
            if (e.key === "Escape") onOpenChange(false)
          }}
        >
          <div className="flex items-center gap-2 px-4 h-12 border-b border-[var(--yu3-line-subtle)]">
            <MagnifyingGlass size={16} weight="regular" className="text-[var(--yu3-ink-muted)]" />
            <CmdK.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search, jump, create…"
              className="flex-1 bg-transparent outline-none text-[14px] text-[var(--yu3-ink-strong)] placeholder:text-[var(--yu3-ink-faint)]"
            />
            <span
              className="yu3-num text-[11px] text-[var(--yu3-ink-faint)] bg-[var(--yu3-bg-surface-sunken)] border border-[var(--yu3-line-subtle)] rounded-[4px] px-1.5 h-5 inline-flex items-center"
              aria-hidden
            >
              ESC
            </span>
          </div>

          <CmdK.List className="max-h-[420px] overflow-auto p-2">
            <CmdK.Empty className="py-8 text-center text-[13px] text-[var(--yu3-ink-muted)]">
              No matches.
            </CmdK.Empty>

            {recent.length > 0 ? (
              <CmdK.Group
                heading={
                  <span className="yu3-t-eyebrow flex items-center gap-1 px-2 py-1">
                    <Clock size={11} /> Recent
                  </span>
                }
              >
                {recent.map((r) => (
                  <CmdK.Item
                    key={r.href}
                    value={`recent-${r.label}`}
                    onSelect={() => navigate(r.href)}
                    className="yu3-palette-item"
                  >
                    <span className="flex-1 truncate">{r.label}</span>
                    {r.subtitle ? (
                      <span className="text-[11px] text-[var(--yu3-ink-faint)]">
                        {r.subtitle}
                      </span>
                    ) : null}
                    <ArrowRight size={12} className="text-[var(--yu3-ink-faint)]" />
                  </CmdK.Item>
                ))}
              </CmdK.Group>
            ) : null}

            <CmdK.Group
              heading={
                <span className="yu3-t-eyebrow px-2 py-1">Jump to</span>
              }
            >
              {SIDEBAR_SECTIONS.flatMap((s) => s.items).map((item) => {
                const Icon = item.Icon
                return (
                  <CmdK.Item
                    key={item.href}
                    value={`jump ${item.label} ${item.href}`}
                    onSelect={() => navigate(item.href)}
                    className="yu3-palette-item"
                  >
                    <Icon size={14} className="text-[var(--yu3-ink-muted)]" />
                    <span className="flex-1 truncate">{item.label}</span>
                    <ArrowRight size={12} className="text-[var(--yu3-ink-faint)]" />
                  </CmdK.Item>
                )
              })}
            </CmdK.Group>

            <CmdK.Group
              heading={
                <span className="yu3-t-eyebrow flex items-center gap-1 px-2 py-1">
                  <Plus size={11} /> Create
                </span>
              }
            >
              {QUICK_ACTIONS.map((a) => (
                <CmdK.Item
                  key={a.href}
                  value={`create ${a.label}`}
                  onSelect={() => navigate(a.href)}
                  className="yu3-palette-item"
                >
                  <Plus size={14} className="text-[var(--yu3-ink-muted)]" />
                  <span className="flex-1 truncate">{a.label}</span>
                  {a.description ? (
                    <span className="text-[11px] text-[var(--yu3-ink-faint)]">
                      {a.description}
                    </span>
                  ) : null}
                </CmdK.Item>
              ))}
            </CmdK.Group>

            <CmdK.Group
              heading={
                <span className="yu3-t-eyebrow flex items-center gap-1 px-2 py-1">
                  <Sparkle size={11} /> Ask
                </span>
              }
            >
              <CmdK.Item
                value="ask ai"
                onSelect={() =>
                  navigate(`/admin?ask=${encodeURIComponent(query)}`)
                }
                className="yu3-palette-item"
              >
                <Sparkle size={14} className="text-[var(--yu3-wine)]" />
                <span className="flex-1 truncate">
                  Ask ops intelligence: {query || "anything"}
                </span>
              </CmdK.Item>
            </CmdK.Group>
          </CmdK.List>
        </CmdK>
      </DialogContent>
    </Dialog>
  )
}
