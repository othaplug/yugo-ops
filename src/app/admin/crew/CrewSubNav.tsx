"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/design-system/admin/lib/cn"

const LINKS = [
  { href: "/admin/crew", label: "Map" },
  { href: "/admin/crew/analytics", label: "Analytics" },
  { href: "/admin/crew/availability", label: "Availability" },
  { href: "/admin/crew/assignments", label: "Assignments" },
] as const

export function CrewSubNav() {
  const pathname = usePathname() || ""
  return (
    <div className="shrink-0 border-b border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] px-4 py-2">
      <nav className="flex flex-wrap gap-1" aria-label="Crew views">
        {LINKS.map((l) => {
          const active =
            l.href === "/admin/crew"
              ? pathname === "/admin/crew" || pathname === "/admin/crew/"
              : pathname === l.href || pathname.startsWith(`${l.href}/`)
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "inline-flex items-center rounded-[var(--yu3-r-md)] px-3 py-1.5 text-[12px] font-semibold transition-colors",
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
  )
}
