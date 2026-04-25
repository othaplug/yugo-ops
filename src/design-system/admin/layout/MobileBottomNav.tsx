"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useFloatingScrollExpandNav } from "@/hooks/useFloatingScrollExpandNav"
import { cn } from "../lib/cn"
import { House, List, MagnifyingGlass, Path } from "../icons"
import { YU3_TOPBAR_SEARCH_INPUT_ID } from "./TopBarInlineSearch"

export interface MobileBottomNavProps {
  onOpenMobileSidebar: () => void
}

const floatSurface =
  "border border-[var(--yu3-line)]/70 bg-[color-mix(in_srgb,var(--yu3-bg-surface)_92%,transparent)] shadow-[var(--yu3-shadow-lg)] backdrop-blur-md supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--yu3-bg-surface)_88%,transparent)]"

export function MobileBottomNav({ onOpenMobileSidebar }: MobileBottomNavProps) {
  const pathname = usePathname() || "/admin"
  const pathnameString = String(pathname)
  const { expanded, clearCollapseTimer, scheduleCollapse, handleCompactTap } =
    useFloatingScrollExpandNav({
      mainElementId: "yu3-main",
      pathname: pathnameString,
    })

  const focusTopSearch = () => {
    if (typeof document === "undefined") return
    const el = document.getElementById(YU3_TOPBAR_SEARCH_INPUT_ID)
    if (el instanceof HTMLInputElement) {
      el.focus()
      el.scrollIntoView({ block: "center", behavior: "smooth" })
    }
  }

  const isHome = pathnameString === "/admin" || pathnameString === "/admin/"
  const isMoves = pathnameString.startsWith("/admin/moves")

  const handleSearchPress = () => {
    focusTopSearch()
    scheduleCollapse()
  }

  const bottomInset =
    "pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))]"

  const itemClass = (active: boolean) =>
    cn(
      "flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5 text-[10px] font-semibold leading-tight transition-colors",
      active
        ? "bg-[color-mix(in_srgb,var(--yu3-ink)_7%,var(--yu3-bg-surface))] text-[var(--yu3-wine)]"
        : "text-[var(--yu3-ink-muted)]",
    )

  return (
    <div
      className={cn(
        "lg:hidden pointer-events-none fixed inset-x-0 bottom-0 z-[var(--yu3-z-sidebar)]",
        bottomInset,
      )}
    >
      <div className="pointer-events-auto w-full max-w-lg flex flex-col items-stretch pr-0">
        {expanded ? (
          <nav
            id="yu3-mobile-bottom-nav-panel"
            className={cn(
              "w-full max-w-md origin-bottom self-start rounded-full px-1 py-1.5",
              "motion-safe:animate-[yu3-mnav-expand_0.32s_ease-out_both]",
              floatSurface,
            )}
            aria-label="Primary"
          >
            <div className="grid grid-cols-4 items-stretch gap-0.5">
              <Link
                href="/admin"
                className={itemClass(isHome)}
                aria-current={isHome ? "page" : undefined}
              >
                <House size={20} weight={isHome ? "fill" : "regular"} />
                <span>Home</span>
              </Link>
              <button
                type="button"
                onClick={handleSearchPress}
                className={itemClass(false)}
                aria-label="Search the app, people, and records"
              >
                <MagnifyingGlass size={20} weight="regular" />
                <span>Search</span>
              </button>
              <Link
                href="/admin/moves"
                className={itemClass(isMoves)}
                aria-current={isMoves ? "page" : undefined}
              >
                <Path size={20} weight={isMoves ? "fill" : "regular"} />
                <span>Moves</span>
              </Link>
              <button
                type="button"
                onClick={onOpenMobileSidebar}
                className={itemClass(false)}
                aria-label="Open full menu"
              >
                <List size={20} weight="regular" />
                <span>More</span>
              </button>
            </div>
          </nav>
        ) : (
          <div className="flex w-full justify-start motion-safe:animate-[yu3-mnav-fab_0.28s_ease-out_both]">
            <button
              type="button"
              onClick={handleCompactTap}
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full",
                floatSurface,
                "transition-transform active:scale-[0.97]",
                isHome ? "text-[var(--yu3-wine)]" : "text-[var(--yu3-ink-muted)]",
              )}
              aria-label="Open navigation"
              aria-expanded="false"
              aria-controls="yu3-mobile-bottom-nav-panel"
            >
              <House size={24} weight={isHome ? "fill" : "regular"} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
