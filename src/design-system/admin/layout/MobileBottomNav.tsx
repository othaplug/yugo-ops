"use client"

import { usePathname } from "next/navigation"
import { FloatingActionMenu } from "@/components/ui/floating-action-menu"
import { cn } from "../lib/cn"
import { House, List, MagnifyingGlass, Path } from "../icons"
import { YU3_TOPBAR_SEARCH_INPUT_ID } from "./TopBarInlineSearch"

export interface MobileBottomNavProps {
  onOpenMobileSidebar: () => void
}

export function MobileBottomNav({ onOpenMobileSidebar }: MobileBottomNavProps) {
  const pathname = usePathname() || "/admin"
  const pathnameString = String(pathname)

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
        triggerLabelClosed="Open navigation"
        triggerLabelOpen="Close navigation"
        triggerIcon={<House size={24} weight="regular" aria-hidden />}
        options={[
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
          {
            label: "More",
            onClick: onOpenMobileSidebar,
            Icon: <List size={16} weight="regular" aria-hidden />,
          },
        ]}
      />
    </div>
  )
}
