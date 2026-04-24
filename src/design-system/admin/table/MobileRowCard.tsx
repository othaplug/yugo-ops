"use client"

import * as React from "react"
import { cn } from "../lib/cn"
import { CaretRight } from "../icons"

export interface MobileRowCardProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  status?: React.ReactNode
  metrics?: { label: string; value: React.ReactNode }[]
  leading?: React.ReactNode
  trailing?: React.ReactNode
  selected?: boolean
  onClick?: () => void
  onSelect?: () => void
  footer?: React.ReactNode
  className?: string
}

export function MobileRowCard({
  title,
  subtitle,
  status,
  metrics,
  leading,
  trailing,
  selected,
  onClick,
  footer,
  className,
}: MobileRowCardProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        "bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line-subtle)] rounded-[var(--yu3-r-lg)]",
        "p-3 transition-colors",
        "hover:border-[var(--yu3-line-strong)]",
        selected &&
          "border-[var(--yu3-wine)] shadow-[0_0_0_3px_var(--yu3-wine-wash)]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {leading ? <div className="shrink-0 pt-0.5">{leading}</div> : null}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-[var(--yu3-ink-strong)] truncate">
                {title}
              </div>
              {subtitle ? (
                <div className="text-[12px] text-[var(--yu3-ink-muted)] truncate mt-0.5">
                  {subtitle}
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {status}
              {trailing || (onClick ? (
                <CaretRight size={14} className="text-[var(--yu3-ink-faint)]" />
              ) : null)}
            </div>
          </div>
          {metrics && metrics.length > 0 ? (
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              {metrics.map((m, i) => (
                <div key={i} className="flex flex-col min-w-0">
                  <dt className="text-[10px] uppercase tracking-[0.08em] font-bold text-[var(--yu3-ink-faint)] truncate">
                    {m.label}
                  </dt>
                  <dd className="text-[12px] text-[var(--yu3-ink)] font-medium truncate yu3-num">
                    {m.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {footer ? <div className="mt-2">{footer}</div> : null}
        </div>
      </div>
    </div>
  )
}
