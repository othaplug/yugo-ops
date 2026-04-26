"use client"

import { useCallback, useMemo } from "react"
import { usePathname } from "next/navigation"
import {
  FloatingActionMenu,
  type FloatingActionMenuOption,
} from "@/components/ui/floating-action-menu"
import { cn } from "../lib/cn"
import { House, List, MagnifyingGlass, Path } from "../icons"
import { YU3_TOPBAR_SEARCH_INPUT_ID } from "./TopBarInlineSearch"
import {
  ROLE_LEVEL,
  SIDEBAR_SECTIONS,
  isNavItemActive,
} from "./nav"

const MAIN_SKIP_HREFS = new Set(["/admin", "/admin/moves"])

export interface MobileBottomNavProps {
  role: string
  isSuperAdmin: boolean
}

export function MobileBottomNav({ role, isSuperAdmin }: MobileBottomNavProps) {
  const pathname = usePathname() || "/admin"
  const pathnameString = String(pathname)

  const focusTopSearch = useCallback(() => {
    if (typeof document === "undefined") return
    const el = document.getElementById(YU3_TOPBAR_SEARCH_INPUT_ID)
    if (el instanceof HTMLInputElement) {
      el.focus()
      el.scrollIntoView({ block: "center", behavior: "smooth" })
    }
  }, [])

  const isHome =
    pathnameString === "/admin" || pathnameString === "/admin/"
  const isMoves = pathnameString.startsWith("/admin/moves")

  const userLevel = ROLE_LEVEL[role] ?? 0
  const visibleNav = useMemo(
    () =>
      SIDEBAR_SECTIONS.flatMap((s) => s.items).filter((item) => {
        const needed = ROLE_LEVEL[item.minRole ?? "viewer"] ?? 0
        return userLevel >= needed || isSuperAdmin
      }),
    [isSuperAdmin, userLevel],
  )

  const subMenuOptions = useMemo((): FloatingActionMenuOption[] => {
    return visibleNav
      .filter((i) => !MAIN_SKIP_HREFS.has(i.href))
      .map((item) => {
        const NavIcon = item.Icon
        return {
          label: item.label,
          href: item.href,
          active: isNavItemActive(pathnameString, item),
          Icon: (
            <NavIcon size={16} weight="regular" className="shrink-0" aria-hidden />
          ),
        }
      })
  }, [visibleNav, pathnameString])

  const hasMore = subMenuOptions.length > 0

  const mainOptions = useMemo((): FloatingActionMenuOption[] => {
    const items: FloatingActionMenuOption[] = [
      {
        label: "Home",
        href: "/admin",
        active: isHome,
        Icon: <House size={16} weight={isHome ? "fill" : "regular"} aria-hidden />,
      },
      {
        label: "Search",
        onClick: focusTopSearch,
        Icon: <MagnifyingGlass size={16} weight="regular" aria-hidden />,
      },
      {
        label: "Moves",
        href: "/admin/moves",
        active: isMoves,
        Icon: <Path size={16} weight={isMoves ? "fill" : "regular"} aria-hidden />,
      },
    ]
    if (hasMore) {
      items.push({
        label: "More",
        opensSubMenu: true,
        Icon: <List size={16} weight="regular" aria-hidden />,
      })
    }
    return items
  }, [focusTopSearch, hasMore, isHome, isMoves])

  const bottomInset =
    "pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))]"

  return (
    <div
      className={cn(
        "lg:hidden pointer-events-none fixed inset-x-0 bottom-0 z-[var(--yu3-z-sidebar)]",
        bottomInset,
      )}
    >
      <FloatingActionMenu
        align="left"
        zIndexClass="z-[var(--yu3-z-sidebar)]"
        subMenuOptions={hasMore ? subMenuOptions : undefined}
        triggerLabelClosed="Open navigation"
        triggerLabelOpen="Close navigation"
        triggerIcon={<House size={24} weight="regular" aria-hidden />}
        options={mainOptions}
      />
    </div>
  )
}
