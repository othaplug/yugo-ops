"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  SIDEBAR_SECTIONS,
  ROLE_LEVEL,
  ALL_NAV_HREFS,
  type NavItem,
} from "./nav"
import { cn } from "../lib/cn"
import { Avatar } from "../primitives/Avatar"
import { Tooltip } from "../primitives/Tooltip"
import { CaretLeft, CaretRight, Sparkle } from "../icons"

export interface SidebarBadges {
  quotes?: number
  changeRequests?: number
}

export interface SidebarProps {
  role: string
  isSuperAdmin: boolean
  collapsed: boolean
  onToggleCollapse: () => void
  onNavigate?: () => void
  user: { email?: string | null; full_name?: string | null } | null
  badges?: SidebarBadges
  workspaceLabel?: string
  workspacePlan?: string
  isMobileOpen?: boolean
  onMobileClose?: () => void
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin"
  if (href === "/admin/crew") return pathname === "/admin/crew"
  if (!pathname.startsWith(href)) return false
  const more = ALL_NAV_HREFS.filter((h) => h !== href && h.startsWith(`${href}/`))
  if (more.length === 0) return true
  if (pathname === href || pathname === `${href}/`) return true
  return !more.some((l) => pathname === l || pathname.startsWith(`${l}/`))
}

function NavRow({
  item,
  active,
  collapsed,
  badge,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  badge?: number
  onNavigate?: () => void
}) {
  const Icon = item.Icon
  const row = (
    <Link
      href={item.href}
      onClick={onNavigate}
      data-active={active ? "true" : undefined}
      className={cn(
        "relative flex items-center gap-2.5 rounded-[var(--yu3-r-md)]",
        "transition-colors duration-[var(--yu3-dur-1)]",
        collapsed ? "justify-center mx-2 h-9 w-9" : "mx-2 px-3 h-9",
        "text-[13px]",
        active
          ? "bg-[var(--yu3-wine-wash)] text-[var(--yu3-ink-strong)] font-semibold"
          : "text-[var(--yu3-ink-muted)] hover:bg-[var(--yu3-bg-surface-sunken)] hover:text-[var(--yu3-ink)] font-medium",
      )}
    >
      {active && !collapsed ? (
        <span
          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-[var(--yu3-wine)]"
          aria-hidden
        />
      ) : null}
      <span
        className={cn(
          "shrink-0 inline-flex items-center justify-center",
          active ? "text-[var(--yu3-wine)]" : "text-[var(--yu3-ink-muted)]",
        )}
      >
        <Icon size={16} weight="regular" />
      </span>
      {!collapsed ? (
        <span className="flex-1 min-w-0 flex items-center justify-between gap-2">
          <span className="truncate">{item.label}</span>
          {badge && badge > 0 ? (
            <span className="yu3-num shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-[4px] text-[10px] font-bold bg-[var(--yu3-wine-tint)] text-[var(--yu3-wine)]">
              {badge > 99 ? "99+" : badge}
            </span>
          ) : null}
        </span>
      ) : null}
      {collapsed && badge && badge > 0 ? (
        <span
          className="absolute top-1 right-1 w-[6px] h-[6px] rounded-full bg-[var(--yu3-wine)]"
          aria-hidden
        />
      ) : null}
    </Link>
  )
  if (collapsed) {
    return (
      <Tooltip side="right" content={item.label}>
        {row}
      </Tooltip>
    )
  }
  return row
}

export function Sidebar({
  role,
  isSuperAdmin,
  collapsed,
  onToggleCollapse,
  onNavigate,
  user,
  badges,
  workspaceLabel = "Yugo+ Workspace",
  workspacePlan = "Operator",
  isMobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname() || "/admin"
  const userLevel = ROLE_LEVEL[role] ?? 0

  const visibleSections = SIDEBAR_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      const needed = ROLE_LEVEL[item.minRole ?? "viewer"] ?? 0
      return userLevel >= needed || isSuperAdmin
    }),
  })).filter((s) => s.items.length > 0)

  return (
    <>
      <aside
        aria-label="Admin sidebar"
        data-mobile-open={isMobileOpen ? "true" : undefined}
        className={cn(
          "group bg-[var(--yu3-bg-surface)] border-r border-[var(--yu3-line-subtle)]",
          "flex flex-col h-full sticky top-0 self-start",
          "z-[var(--yu3-z-sidebar)]",
          // desktop
          "max-lg:fixed max-lg:top-0 max-lg:left-0 max-lg:h-dvh",
          "max-lg:transition-transform max-lg:duration-[var(--yu3-dur-2)]",
          "max-lg:w-[272px]",
          isMobileOpen
            ? "max-lg:translate-x-0 max-lg:shadow-[var(--yu3-shadow-lg)]"
            : "max-lg:-translate-x-full",
        )}
        style={{
          width: collapsed ? "var(--yu3-sidebar-rail-w)" : "var(--yu3-sidebar-w)",
        }}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center gap-2 h-14 border-b border-[var(--yu3-line-subtle)]",
            collapsed ? "justify-center px-2" : "px-4",
          )}
        >
          {!collapsed ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div
                className="flex items-center justify-center h-7 w-7 rounded-[var(--yu3-r-sm)] bg-[var(--yu3-wine)] text-[var(--yu3-on-wine)] text-[13px] font-bold"
                aria-hidden
              >
                Y
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[var(--yu3-ink-strong)] leading-tight truncate">
                  Yugo+
                </div>
                <div className="text-[11px] text-[var(--yu3-ink-faint)] leading-tight truncate">
                  {workspacePlan}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="flex items-center justify-center h-7 w-7 rounded-[var(--yu3-r-sm)] bg-[var(--yu3-wine)] text-[var(--yu3-on-wine)] text-[13px] font-bold"
              aria-hidden
            >
              Y
            </div>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:inline-flex items-center justify-center h-7 w-7 rounded-[var(--yu3-r-sm)] text-[var(--yu3-ink-muted)] hover:bg-[var(--yu3-bg-surface-sunken)] hover:text-[var(--yu3-ink)]"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <CaretRight size={14} /> : <CaretLeft size={14} />}
          </button>
          <button
            type="button"
            onClick={onMobileClose}
            className="lg:hidden inline-flex items-center justify-center h-7 w-7 rounded-[var(--yu3-r-sm)] text-[var(--yu3-ink-muted)] hover:bg-[var(--yu3-bg-surface-sunken)] hover:text-[var(--yu3-ink)]"
            aria-label="Close sidebar"
          >
            <CaretLeft size={14} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {visibleSections.map((section) => (
            <div key={section.label} className="mb-4">
              {!collapsed ? (
                <div className="yu3-t-eyebrow px-4 mb-1.5">{section.label}</div>
              ) : (
                <div className="mx-2 mb-1.5 h-px bg-[var(--yu3-line-subtle)]" />
              )}
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const badge =
                    item.badgeKey === "quotes"
                      ? badges?.quotes
                      : item.badgeKey === "changeRequests"
                        ? badges?.changeRequests
                        : undefined
                  return (
                    <NavRow
                      key={item.href}
                      item={item}
                      active={isActive(pathname, item.href)}
                      collapsed={collapsed}
                      badge={badge}
                      onNavigate={onNavigate}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer — workspace / user */}
        <div
          className={cn(
            "border-t border-[var(--yu3-line-subtle)] p-3",
            collapsed ? "flex flex-col items-center gap-2" : "",
          )}
        >
          {!collapsed ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5 p-2 rounded-[var(--yu3-r-md)] hover:bg-[var(--yu3-bg-surface-sunken)]">
                <Avatar
                  name={user?.full_name || user?.email || "User"}
                  size={28}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[var(--yu3-ink-strong)] truncate">
                    {user?.full_name || user?.email?.split("@")[0] || "Operator"}
                  </div>
                  <div className="text-[11px] text-[var(--yu3-ink-faint)] truncate">
                    {user?.email || ""}
                  </div>
                </div>
              </div>
              <div className="rounded-[var(--yu3-r-md)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface-sunken)] p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--yu3-ink-muted)]">
                  <Sparkle size={12} weight="regular" />
                  <span>Ops intelligence</span>
                </div>
                <p className="text-[11px] text-[var(--yu3-ink-muted)] mt-1 leading-snug">
                  Ask the assistant for lead intel, quote trends, or crew
                  availability.
                </p>
              </div>
            </div>
          ) : (
            <Tooltip
              side="right"
              content={user?.full_name || user?.email || "Account"}
            >
              <Avatar
                name={user?.full_name || user?.email || "User"}
                size={28}
              />
            </Tooltip>
          )}
        </div>
      </aside>

      {/* Mobile scrim */}
      {isMobileOpen ? (
        <button
          type="button"
          onClick={onMobileClose}
          aria-label="Close sidebar"
          className="lg:hidden fixed inset-0 z-[calc(var(--yu3-z-sidebar)-1)] bg-[var(--yu3-bg-overlay)]"
        />
      ) : null}
    </>
  )
}
