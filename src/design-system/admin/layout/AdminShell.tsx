"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import NextTopLoader from "nextjs-toploader"
import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"
import { MobileBottomNav } from "./MobileBottomNav"
import { CommandPalette } from "./CommandPalette"
import { Drawer, DrawerContent } from "../primitives/Drawer"
import { Button } from "../primitives/Button"
import { QUICK_ACTIONS } from "./nav"
import { Plus } from "../icons"
import { cn } from "../lib/cn"
import FloatingActionMenu from "@/components/ui/floating-action-menu"

export interface AdminShellProps {
  children: React.ReactNode
  user: {
    id?: string
    email?: string | null
    full_name?: string | null
  } | null
  role: string
  isSuperAdmin: boolean
  badges?: { quotes?: number; changeRequests?: number }
  notificationCount?: number
  breadcrumbs?: { label: string; href?: string }[]
  onSignOut?: () => void
}

const STORAGE_COLLAPSED = "yu3.sidebar.collapsed"
const STORAGE_THEME = "yu3.theme"

export function AdminShell({
  children,
  user,
  role,
  isSuperAdmin,
  badges,
  notificationCount = 0,
  breadcrumbs,
  onSignOut,
}: AdminShellProps) {
  const router = useRouter()
  const pathname = usePathname() || "/admin"

  const [collapsed, setCollapsed] = React.useState<boolean>(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [quickCreateOpen, setQuickCreateOpen] = React.useState(false)
  const [paletteOpen, setPaletteOpen] = React.useState(false)
  const [theme, setTheme] = React.useState<"light" | "dark">("light")

  // Read stored prefs on mount
  React.useEffect(() => {
    try {
      const c = localStorage.getItem(STORAGE_COLLAPSED)
      if (c === "1") setCollapsed(true)
      const t = localStorage.getItem(STORAGE_THEME)
      if (t === "dark") setTheme("dark")
    } catch {
      /* ignore */
    }
  }, [])

  // Persist collapsed
  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_COLLAPSED, collapsed ? "1" : "0")
    } catch {
      /* ignore */
    }
  }, [collapsed])

  // Persist theme
  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_THEME, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  // Close mobile nav on route change
  React.useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Keyboard: ⌘K, G then L / Q etc.
  React.useEffect(() => {
    let lastKey: { key: string; t: number } | null = null
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      if ((e.metaKey || e.ctrlKey || e.altKey) || e.isComposing) return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      )
        return
      if (e.key === "[") {
        setCollapsed((v) => !v)
        return
      }
      if (e.key.toLowerCase() === "g") {
        lastKey = { key: "g", t: Date.now() }
        return
      }
      if (lastKey && lastKey.key === "g" && Date.now() - lastKey.t < 1200) {
        const k = e.key.toLowerCase()
        const map: Record<string, string> = {
          h: "/admin",
          l: "/admin/leads",
          q: "/admin/quotes",
          m: "/admin/moves",
          c: "/admin/clients",
          d: "/admin/dispatch",
        }
        if (map[k]) {
          router.push(map[k]!)
          lastKey = null
          return
        }
      }
    }
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [router])

  return (
    <div
      data-yugo-admin-v3=""
      data-theme={theme}
      className="min-h-dvh w-full"
    >
      <NextTopLoader
        color="var(--yu3-wine)"
        height={2}
        showSpinner={false}
        easing="ease"
        speed={300}
      />
      <div className="yu3-shell" data-collapsed={collapsed ? "true" : "false"}>
        <Sidebar
          role={role}
          isSuperAdmin={isSuperAdmin}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          onNavigate={() => setMobileOpen(false)}
          user={user}
          badges={badges}
          isMobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <div className="yu3-main">
          <TopBar
            onOpenMobileNav={() => setMobileOpen(true)}
            onOpenCommandPalette={() => setPaletteOpen(true)}
            userEmail={user?.email}
            userName={user?.full_name}
            notificationCount={notificationCount}
            theme={theme}
            onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            onSignOut={onSignOut}
            breadcrumbs={breadcrumbs}
          />
          <main
            id="yu3-main"
            className={cn("yu3-page flex flex-col")}
            data-wide={undefined}
          >
            {children}
          </main>
        </div>
      </div>

      <MobileBottomNav
        onOpenMobileSidebar={() => setMobileOpen(true)}
        onQuickCreate={() => setQuickCreateOpen(true)}
      />

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      <FloatingActionMenu
        options={QUICK_ACTIONS.map((a) => ({
          label: a.label,
          description: a.description,
          onClick: () => router.push(a.href),
        }))}
      />

      <Drawer open={quickCreateOpen} onOpenChange={setQuickCreateOpen}>
        <DrawerContent
          side="bottom"
          size="md"
          title="Quick create"
          description="Jump straight into the most common operator flows."
        >
          <div className="p-4 grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((a) => (
              <Button
                key={a.href}
                asChild
                variant="secondary"
                size="lg"
                className="justify-start h-auto py-3 text-left"
                leadingIcon={<Plus size={14} />}
              >
                <a href={a.href}>
                  <span className="flex flex-col">
                    <span className="text-[13px] font-semibold text-[var(--yu3-ink-strong)]">
                      {a.label}
                    </span>
                    <span className="text-[11px] text-[var(--yu3-ink-muted)] font-normal">
                      {a.description}
                    </span>
                  </span>
                </a>
              </Button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
