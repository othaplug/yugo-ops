"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "../lib/cn"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../primitives/DropdownMenu"
import { Avatar } from "../primitives/Avatar"
import {
  Bell,
  List,
  Command,
  CaretDown,
  Sun,
  Moon,
  Sparkle,
} from "../icons"

export interface TopBarProps {
  onOpenMobileNav: () => void
  onOpenCommandPalette: () => void
  userEmail?: string | null
  userName?: string | null
  notificationCount?: number
  theme?: "light" | "dark"
  onToggleTheme?: () => void
  onSignOut?: () => void
  breadcrumbs?: { label: string; href?: string }[]
}

export function TopBar({
  onOpenMobileNav,
  onOpenCommandPalette,
  userEmail,
  userName,
  notificationCount = 0,
  theme = "light",
  onToggleTheme,
  onSignOut,
  breadcrumbs,
}: TopBarProps) {
  const router = useRouter()
  return (
    <header
      className={cn(
        "yu3-glass sticky top-0 z-[var(--yu3-z-topbar)]",
        "flex items-center gap-3 px-4 lg:px-6",
        "h-[var(--yu3-topbar-h)]",
      )}
    >
      {/* Left: mobile hamburger + breadcrumbs */}
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="lg:hidden inline-flex items-center justify-center h-8 w-8 rounded-[var(--yu3-r-sm)] text-[var(--yu3-ink-muted)] hover:bg-[var(--yu3-bg-surface-sunken)] hover:text-[var(--yu3-ink)]"
        aria-label="Open sidebar"
      >
        <List size={18} weight="regular" />
      </button>

      <nav
        aria-label="Breadcrumb"
        className="hidden md:flex items-center gap-1 text-[13px] text-[var(--yu3-ink-muted)] min-w-0"
      >
        {(breadcrumbs || []).map((crumb, i, arr) => (
          <span key={`${crumb.label}-${i}`} className="flex items-center gap-1 min-w-0">
            {crumb.href && i < arr.length - 1 ? (
              <Link
                href={crumb.href}
                className="hover:text-[var(--yu3-ink-strong)] truncate"
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                className={cn(
                  "truncate",
                  i === arr.length - 1 && "text-[var(--yu3-ink-strong)] font-medium",
                )}
              >
                {crumb.label}
              </span>
            )}
            {i < arr.length - 1 ? (
              <span className="text-[var(--yu3-ink-faint)] mx-0.5">/</span>
            ) : null}
          </span>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Center: command search trigger */}
      <button
        type="button"
        onClick={onOpenCommandPalette}
        className={cn(
          "hidden sm:flex items-center gap-2",
          "h-9 px-3 min-w-[240px] max-w-[420px]",
          "rounded-[var(--yu3-r-md)] border border-[var(--yu3-line)]",
          "bg-[var(--yu3-bg-surface)] text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-ink)]",
          "text-[13px]",
        )}
        aria-label="Open search"
      >
        <Sparkle size={14} weight="regular" className="text-[var(--yu3-wine)]" />
        <span className="flex-1 text-left truncate">Search leads, moves, people…</span>
        <span
          className="yu3-num inline-flex items-center gap-1 text-[11px] text-[var(--yu3-ink-faint)] bg-[var(--yu3-bg-surface-sunken)] border border-[var(--yu3-line-subtle)] rounded-[4px] px-1.5 h-5"
          aria-hidden
        >
          <Command size={10} weight="regular" /> K
        </span>
      </button>

      {/* Right: theme + notifications + profile */}
      <button
        type="button"
        onClick={onToggleTheme}
        className="hidden md:inline-flex items-center justify-center h-9 w-9 rounded-[var(--yu3-r-md)] text-[var(--yu3-ink-muted)] hover:bg-[var(--yu3-bg-surface-sunken)] hover:text-[var(--yu3-ink)]"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun size={16} weight="regular" /> : <Moon size={16} weight="regular" />}
      </button>

      <Link
        href="/admin/notifications"
        className="relative inline-flex items-center justify-center h-9 w-9 rounded-[var(--yu3-r-md)] text-[var(--yu3-ink-muted)] hover:bg-[var(--yu3-bg-surface-sunken)] hover:text-[var(--yu3-ink)]"
        aria-label="Notifications"
      >
        <Bell size={16} weight="regular" />
        {notificationCount > 0 ? (
          <span
            className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--yu3-wine)] text-[var(--yu3-on-wine)] text-[10px] font-bold flex items-center justify-center"
            aria-hidden
          >
            {notificationCount > 99 ? "99+" : notificationCount}
          </span>
        ) : null}
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-[var(--yu3-r-md)] hover:bg-[var(--yu3-bg-surface-sunken)] px-1 h-9"
            aria-label="Account menu"
          >
            <Avatar name={userName || userEmail || "User"} size={28} />
            <span className="hidden md:inline text-[12px] text-[var(--yu3-ink-muted)]">
              <CaretDown size={12} />
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[240px]">
          <div className="px-2 py-1.5">
            <div className="text-[13px] font-semibold text-[var(--yu3-ink-strong)] truncate">
              {userName || userEmail?.split("@")[0] || "Operator"}
            </div>
            {userEmail ? (
              <div className="text-[11px] text-[var(--yu3-ink-faint)] truncate">
                {userEmail}
              </div>
            ) : null}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => router.push("/admin/settings/personal")}>
            Account settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push("/admin/settings/security")}>
            Security
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push("/admin/notifications")}>
            Notifications
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem danger onSelect={onSignOut}>
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
