"use client"

import { useState, type ReactNode } from "react"
import { CaretDown } from "@phosphor-icons/react"

type AppSettingsCollapsibleSectionProps = {
  id: string
  title: ReactNode
  subtitle?: string
  defaultOpen?: boolean
  /** Extra classes on the outer section (e.g. first block: pt-0 border-t-0) */
  sectionClassName?: string
  children: ReactNode
}

export default function AppSettingsCollapsibleSection({
  id,
  title,
  subtitle,
  defaultOpen = true,
  sectionClassName = "",
  children,
}: AppSettingsCollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className={`pt-6 border-t border-[var(--brd)]/30 ${sectionClassName}`}>
      <button
        type="button"
        id={`${id}-heading`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className="w-full flex items-start justify-between gap-3 text-left mb-3 rounded-lg hover:bg-[var(--bg)]/25 px-1 -mx-1 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary-fill)]/80 focus-visible:ring-offset-1"
      >
        <div className="min-w-0 flex-1">
          <div className="admin-section-h2 flex items-center gap-2 flex-wrap">{title}</div>
          {subtitle ? <p className="text-[11px] text-[var(--tx3)] mt-0.5">{subtitle}</p> : null}
        </div>
        <CaretDown
          className={`shrink-0 w-5 h-5 text-[var(--tx3)] transition-transform mt-0.5 ${open ? "rotate-180" : ""}`}
          weight="bold"
          aria-hidden
        />
      </button>
      {open ? (
        <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-heading`}>
          {children}
        </div>
      ) : null}
    </section>
  )
}
