"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/design-system/admin/lib/cn"

const LINKS = [
  { href: "/admin/b2b/jobs", label: "Jobs" },
  { href: "/admin/b2b/jobs/inbound", label: "Inbound shipments" },
] as const

export function B2bJobsSubNav() {
  const pathname = usePathname() || ""
  return (
    <div className="shrink-0 border-b border-[var(--yu3-line-subtle)]/80 bg-[var(--yu3-bg-canvas)] px-4 py-2.5">
      <div className="inline-flex w-full max-w-md rounded-full border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] p-1 shadow-[var(--yu3-shadow-sm)]">
        <nav className="flex w-full gap-0.5" aria-label="B2B jobs">
          {LINKS.map((l) => {
            const active =
              l.href === "/admin/b2b/jobs"
                ? pathname === "/admin/b2b/jobs" || pathname === "/admin/b2b/jobs/"
                : pathname === l.href || pathname.startsWith(`${l.href}/`)
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "min-w-0 flex-1 rounded-full px-3 py-2 text-center text-[12px] font-semibold transition-colors",
                  active
                    ? "bg-[var(--yu3-wine-wash)] text-[var(--yu3-wine)]"
                    : "text-[var(--yu3-ink-muted)] hover:bg-[var(--yu3-bg-surface-sunken)] hover:text-[var(--yu3-ink)]",
                )}
              >
                {l.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
