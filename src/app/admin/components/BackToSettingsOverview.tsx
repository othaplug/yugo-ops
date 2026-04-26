"use client"

import Link from "next/link"
import { ArrowLeft } from "@/design-system/admin/icons"
import { cn } from "@/design-system/admin/lib/cn"

const linkClassName = cn(
  "inline-flex w-fit items-center gap-1.5 rounded-[var(--yu3-r-md)] px-2 py-1.5 -ml-2",
  "text-[13px] font-medium text-[var(--yu3-ink-muted)] transition-colors",
  "hover:bg-[var(--yu3-bg-surface-sunken)] hover:text-[var(--yu3-ink)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--yu3-wine)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--yu3-bg-canvas)]",
)

/** Link to the settings card hub (`/admin/settings`). */
export function BackToSettingsOverview({
  className,
}: {
  className?: string
}) {
  return (
    <Link
      href="/admin/settings"
      className={cn(linkClassName, className)}
      aria-label="Back to settings overview"
    >
      <ArrowLeft size={16} weight="regular" aria-hidden className="shrink-0" />
      Back
    </Link>
  )
}
