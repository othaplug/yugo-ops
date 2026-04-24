"use client"

import * as React from "react"
import { cn } from "../lib/cn"
import { Avatar } from "../primitives/Avatar"

export type ActivityItem = {
  id: string
  actor?: { name: string; avatarUrl?: string | null }
  subject: React.ReactNode
  action?: string
  target?: React.ReactNode
  time: string
  icon?: React.ReactNode
  tone?: "neutral" | "wine" | "forest" | "success" | "warning" | "danger" | "info"
  onClick?: () => void
}

export interface ActivityCardProps extends React.HTMLAttributes<HTMLDivElement> {
  items: ActivityItem[]
  eyebrow?: string
  title?: string
  emptyLabel?: string
  rightSlot?: React.ReactNode
  /** Limit items shown; "Show all" reveals the rest. */
  initialCount?: number
}

export const ActivityCard = React.forwardRef<HTMLDivElement, ActivityCardProps>(
  (
    {
      items,
      eyebrow,
      title,
      rightSlot,
      emptyLabel = "No recent activity",
      initialCount = 8,
      className,
      ...rest
    },
    ref,
  ) => {
    const [expanded, setExpanded] = React.useState(false)
    const visible = expanded ? items : items.slice(0, initialCount)

    return (
      <div
        ref={ref}
        className={cn(
          "bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line-subtle)] rounded-[var(--yu3-r-lg)] flex flex-col",
          className,
        )}
        {...rest}
      >
        {(eyebrow || title || rightSlot) && (
          <header className="flex items-end justify-between gap-3 px-5 pt-4 pb-3 border-b border-[var(--yu3-line-subtle)]">
            <div>
              {eyebrow ? (
                <div className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">
                  {eyebrow}
                </div>
              ) : null}
              {title ? (
                <h3 className="text-[15px] font-semibold text-[var(--yu3-ink-strong)] mt-0.5 leading-tight">
                  {title}
                </h3>
              ) : null}
            </div>
            {rightSlot}
          </header>
        )}

        {visible.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-[var(--yu3-ink-muted)]">
            {emptyLabel}
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--yu3-line-subtle)]">
            {visible.map((it) => (
              <li
                key={it.id}
                onClick={it.onClick}
                className={cn(
                  "flex items-start gap-3 px-5 py-3",
                  it.onClick && "cursor-pointer hover:bg-[var(--yu3-bg-surface-sunken)]",
                )}
              >
                {it.actor ? (
                  <Avatar name={it.actor.name} src={it.actor.avatarUrl} size={28} />
                ) : it.icon ? (
                  <span
                    className="h-7 w-7 rounded-full inline-flex items-center justify-center flex-none border border-[var(--yu3-line-subtle)]"
                    style={{
                      background: toneTint(it.tone),
                      color: toneColor(it.tone),
                    }}
                  >
                    {it.icon}
                  </span>
                ) : (
                  <span className="h-7 w-7 rounded-full bg-[var(--yu3-bg-surface-sunken)] flex-none" />
                )}
                <div className="min-w-0 flex-1 flex flex-col leading-tight">
                  <div className="text-[13px] text-[var(--yu3-ink)]">
                    {it.actor?.name ? (
                      <span className="font-medium text-[var(--yu3-ink-strong)]">
                        {it.actor.name}
                      </span>
                    ) : null}
                    {it.actor?.name && it.action ? " " : null}
                    {it.action ? (
                      <span className="text-[var(--yu3-ink-muted)]">{it.action}</span>
                    ) : null}
                    {it.target ? <> {it.target}</> : null}
                  </div>
                  {it.subject && (it.actor?.name || it.action) ? (
                    <div className="text-[12px] text-[var(--yu3-ink-muted)] mt-0.5 truncate">
                      {it.subject}
                    </div>
                  ) : !it.action ? (
                    <div className="text-[13px] text-[var(--yu3-ink)]">
                      {it.subject}
                    </div>
                  ) : null}
                </div>
                <span className="text-[11px] text-[var(--yu3-ink-faint)] flex-none mt-0.5">
                  {it.time}
                </span>
              </li>
            ))}
          </ul>
        )}

        {items.length > initialCount ? (
          <div className="border-t border-[var(--yu3-line-subtle)] px-5 py-2.5">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--yu3-wine)] hover:text-[var(--yu3-wine-hover)]"
            >
              {expanded ? "Show less" : `Show all (${items.length})`}
            </button>
          </div>
        ) : null}
      </div>
    )
  },
)
ActivityCard.displayName = "ActivityCard"

function toneTint(tone?: ActivityItem["tone"]) {
  switch (tone) {
    case "wine":
      return "var(--yu3-wine-tint)"
    case "forest":
      return "var(--yu3-forest-tint)"
    case "success":
      return "var(--yu3-success-tint)"
    case "warning":
      return "var(--yu3-warning-tint)"
    case "danger":
      return "var(--yu3-danger-tint)"
    case "info":
      return "var(--yu3-info-tint)"
    default:
      return "var(--yu3-bg-surface-sunken)"
  }
}

function toneColor(tone?: ActivityItem["tone"]) {
  switch (tone) {
    case "wine":
      return "var(--yu3-wine)"
    case "forest":
      return "var(--yu3-forest)"
    case "success":
      return "var(--yu3-success)"
    case "warning":
      return "var(--yu3-warning)"
    case "danger":
      return "var(--yu3-danger)"
    case "info":
      return "var(--yu3-info)"
    default:
      return "var(--yu3-ink-muted)"
  }
}
