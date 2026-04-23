"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icon, type IconName } from "../primitives/Icon"
import { Badge } from "../primitives/Badge"
import { Avatar } from "../primitives/Avatar"
import {
  Tooltip,
  TooltipProvider,
} from "../primitives/Tooltip"
import { useSidebarStore } from "../stores/sidebar-store"
import {
  ADMIN_V2_BASE,
  FOOTER_NAV,
  NAV_GROUPS,
  isActiveHref,
  type NavItem,
} from "../config/nav"
import { cn } from "../lib/cn"

type SidebarUser = {
  name: string
  email?: string
  avatarSrc?: string | null
}

type SidebarProps = {
  user?: SidebarUser
  badges?: Record<string, number | undefined>
  onSignOut?: () => void
  className?: string
}

const NavLink = ({
  item,
  collapsed,
  active,
  badge,
}: {
  item: NavItem
  collapsed: boolean
  active: boolean
  badge?: number
}) => {
  const content = (
    <Link
      href={item.href}
      className={cn(
        "group flex h-10 items-center gap-3 rounded-md text-fg-muted transition-colors outline-none",
        "hover:bg-surface-subtle hover:text-fg",
        "focus-visible:ring-2 focus-visible:ring-accent/30",
        active && "bg-surface-sunken text-fg",
        collapsed ? "justify-center px-0" : "px-3",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon
        name={item.icon as IconName}
        size="md"
        weight={active ? "fill" : "regular"}
        className={cn(active ? "text-fg" : "text-fg-muted")}
      />
      {collapsed ? null : (
        <>
          <span className="body-sm font-medium truncate">{item.label}</span>
          {badge && badge > 0 ? (
            <Badge tone="neutral" className="ml-auto">
              {badge > 99 ? "99+" : badge}
            </Badge>
          ) : null}
        </>
      )}
    </Link>
  )

  if (!collapsed) return content

  return (
    <Tooltip content={item.label} side="right">
      {content}
    </Tooltip>
  )
}

export const Sidebar = ({ user, badges, onSignOut, className }: SidebarProps) => {
  const pathname = usePathname() ?? ""
  const collapsed = useSidebarStore((s) => s.collapsed)
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed)

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "flex h-full shrink-0 flex-col border-r border-line bg-surface transition-[width]",
          collapsed ? "w-[72px]" : "w-[240px]",
          className,
        )}
        data-collapsed={collapsed ? "" : undefined}
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-line",
            collapsed ? "justify-center px-0" : "justify-between px-4",
          )}
        >
          {collapsed ? (
            <Link
              href={`${ADMIN_V2_BASE}/dashboard`}
              className="flex size-9 items-center justify-center rounded-md"
              aria-label="Yugo"
            >
              <Image
                src="/yugo-symbol.png"
                alt="Yugo"
                width={28}
                height={28}
                className="size-7 select-none object-contain"
                priority
                unoptimized
              />
            </Link>
          ) : (
            <Link
              href={`${ADMIN_V2_BASE}/dashboard`}
              className="flex items-center"
              aria-label="Yugo admin home"
            >
              <Image
                src="/images/yugo-logo-black.png"
                alt="Yugo"
                width={96}
                height={24}
                className="h-6 w-auto select-none object-contain dark:hidden"
                priority
                unoptimized
              />
              <Image
                src="/images/yugo-logo-cream.png"
                alt="Yugo"
                width={96}
                height={24}
                className="hidden h-6 w-auto select-none object-contain dark:block"
                priority
                unoptimized
              />
            </Link>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-md text-fg-muted transition-colors",
              "hover:bg-surface-subtle hover:text-fg",
              "focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none",
              collapsed && "absolute right-2 top-4",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon
              name={collapsed ? "caretRight" : "caretLeft"}
              size="sm"
            />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group, groupIndex) => (
            <div
              key={group.id}
              className={cn("flex flex-col gap-0.5", groupIndex > 0 && "mt-6")}
            >
              {!collapsed && group.label ? (
                <p className="mb-1 px-3 label-sm text-fg-subtle uppercase tracking-[0.08em]">
                  {group.label}
                </p>
              ) : null}
              {collapsed && groupIndex > 0 ? (
                <span
                  aria-hidden
                  className="mx-auto mb-2 block h-px w-8 bg-line"
                />
              ) : null}
              {group.items.map((item) => (
                <NavLink
                  key={item.id}
                  item={item}
                  collapsed={collapsed}
                  active={isActiveHref(item.href, pathname)}
                  badge={item.badgeKey ? badges?.[item.badgeKey] : undefined}
                />
              ))}
            </div>
          ))}
        </nav>

        <div
          className={cn(
            "shrink-0 border-t border-line py-3",
            collapsed ? "px-2" : "px-3",
          )}
        >
          <div className="flex flex-col gap-0.5">
            {FOOTER_NAV.map((item) => (
              <NavLink
                key={item.id}
                item={item}
                collapsed={collapsed}
                active={isActiveHref(item.href, pathname)}
              />
            ))}
          </div>
          {user ? (
            <div
              className={cn(
                "mt-3 flex items-center rounded-md",
                collapsed ? "justify-center p-1" : "gap-3 border border-line bg-surface-subtle px-2 py-2",
              )}
            >
              <Avatar
                name={user.name}
                src={user.avatarSrc ?? undefined}
                size={collapsed ? "md" : "md"}
              />
              {collapsed ? null : (
                <div className="min-w-0 flex-1">
                  <p className="body-sm font-medium text-fg truncate">
                    {user.name}
                  </p>
                  {user.email ? (
                    <p className="body-xs text-fg-muted truncate">
                      {user.email}
                    </p>
                  ) : null}
                </div>
              )}
              {collapsed || !onSignOut ? null : (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none"
                  aria-label="Sign out"
                >
                  <Icon name="signOut" size="sm" />
                </button>
              )}
            </div>
          ) : null}
        </div>
      </aside>
    </TooltipProvider>
  )
}
