"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "../lib/cn"
import { House, Plus, List } from "../icons"

export interface MobileBottomNavProps {
  onOpenMobileSidebar: () => void
  onQuickCreate: () => void
}

export function MobileBottomNav({
  onOpenMobileSidebar,
  onQuickCreate,
}: MobileBottomNavProps) {
  const pathname = usePathname() || "/admin"
  const isHome = pathname === "/admin"
  return (
    <nav
      className={cn(
        "lg:hidden fixed bottom-0 left-0 right-0 z-[var(--yu3-z-sidebar)]",
        "bg-[var(--yu3-bg-surface)]",
        "border-t border-[var(--yu3-line)]",
        "pb-[max(env(safe-area-inset-bottom),var(--yu3-sp-2))]",
      )}
      style={{ height: "var(--yu3-mobile-navbar-h)" }}
      aria-label="Primary"
    >
      <div className="relative h-full grid grid-cols-3 items-center px-2">
        <Link
          href="/admin"
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 h-full",
            isHome
              ? "text-[var(--yu3-ink-strong)]"
              : "text-[var(--yu3-ink-muted)]",
          )}
        >
          <House size={18} weight={isHome ? "fill" : "regular"} />
          <span className="text-[10px] font-semibold">Home</span>
        </Link>

        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={onQuickCreate}
            className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-[var(--yu3-wine)] text-[var(--yu3-on-wine)] shadow-[var(--yu3-shadow-md)] -translate-y-4"
            aria-label="Quick create"
          >
            <Plus size={18} weight="bold" />
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="flex flex-col items-center justify-center gap-0.5 h-full text-[var(--yu3-ink-muted)]"
          aria-label="Open menu"
        >
          <List size={18} weight="regular" />
          <span className="text-[10px] font-semibold">More</span>
        </button>
      </div>
    </nav>
  )
}
