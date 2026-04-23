"use client"

import * as React from "react"
import { Toaster } from "sonner"
import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"
import { useSidebarStore } from "../stores/sidebar-store"
import { useTheme } from "../providers/theme-provider"
import { cn } from "../lib/cn"

export type AdminShellUser = {
  name: string
  email?: string
  avatarSrc?: string | null
}

export type AdminShellProps = {
  user?: AdminShellUser
  badges?: Record<string, number | undefined>
  unreadNotifications?: number
  onSignOut?: () => void
  onOpenCommandPalette?: () => void
  onOpenNotifications?: () => void
  children: React.ReactNode
}

export const AdminShell = ({
  user,
  badges,
  unreadNotifications,
  onSignOut,
  onOpenCommandPalette,
  onOpenNotifications,
  children,
}: AdminShellProps) => {
  const mobileOpen = useSidebarStore((s) => s.mobileOpen)
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen)
  const { resolvedTheme } = useTheme()

  return (
    <div className="flex h-dvh w-full flex-col bg-canvas md:p-6">
      <div className="flex h-full w-full min-h-0 overflow-hidden rounded-none border-0 md:rounded-lg md:border md:border-line md:shadow-sm">
        <div className="hidden h-full md:block">
          <Sidebar user={user} badges={badges} onSignOut={onSignOut} />
        </div>

        {mobileOpen ? (
          <div
            className="fixed inset-0 z-40 flex md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-[4px]"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <div className="relative z-10 h-full">
              <Sidebar user={user} badges={badges} onSignOut={onSignOut} />
            </div>
          </div>
        ) : null}

        <div className="flex h-full min-w-0 flex-1 flex-col bg-surface">
          <TopBar
            user={user}
            unreadNotifications={unreadNotifications}
            onOpenCommandPalette={onOpenCommandPalette}
            onOpenNotifications={onOpenNotifications}
            onSignOut={onSignOut}
          />
          <main
            className={cn(
              "flex-1 overflow-y-auto",
              "px-4 py-5 md:px-8 md:py-6",
            )}
          >
            {children}
          </main>
        </div>
      </div>
      <Toaster
        richColors
        closeButton
        position="top-right"
        theme={resolvedTheme}
      />
    </div>
  )
}
