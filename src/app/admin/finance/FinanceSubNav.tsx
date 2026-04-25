"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/design-system/admin/lib/cn"

const LINKS = [
  { href: "/admin/finance", label: "Overview" },
  { href: "/admin/finance/invoices", label: "Invoices" },
  { href: "/admin/finance/revenue", label: "Revenue trends" },
  { href: "/admin/finance/profitability", label: "Profitability" },
  { href: "/admin/finance/forecast", label: "Forecast" },
  { href: "/admin/finance/tips", label: "Tips" },
] as const

export function FinanceSubNav() {
  const pathname = usePathname() || ""
  return (
    <div className="shrink-0 border-b border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] px-4 py-2">
      <nav
        className="flex flex-wrap gap-1"
        aria-label="Finance sections"
      >
        {LINKS.map((l) => {
          const active =
            l.href === "/admin/finance"
              ? pathname === "/admin/finance" || pathname === "/admin/finance/"
              :             l.href === "/admin/finance/tips"
                ? pathname === "/admin/finance/tips" ||
                  pathname.startsWith("/admin/finance/tips/")
                : l.href === "/admin/finance/forecast"
                  ? pathname === "/admin/finance/forecast" ||
                    pathname.startsWith("/admin/finance/forecast/")
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
