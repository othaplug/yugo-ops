"use client"

import * as React from "react"
import { useSidebarStore } from "../stores/sidebar-store"
import { Icon } from "../primitives/Icon"
import { Breadcrumb, type BreadcrumbSegment } from "../composites/Breadcrumb"
import { Avatar } from "../primitives/Avatar"
import {
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownPortal,
  DropdownRoot,
  DropdownSeparator,
  DropdownTrigger,
} from "../primitives/Dropdown"
import { cn } from "../lib/cn"

type TopBarUser = {
  name: string
  email?: string
  avatarSrc?: string | null
}

export type TopBarProps = {
  user?: TopBarUser
  breadcrumb?: BreadcrumbSegment[]
  unreadNotifications?: number
  onOpenCommandPalette?: () => void
  onOpenNotifications?: () => void
  onSignOut?: () => void
  className?: string
}

const IconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { badge?: number }
>(({ className, badge, children, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      "relative inline-flex size-9 items-center justify-center rounded-md text-fg-muted transition-colors",
      "hover:bg-surface-subtle hover:text-fg",
      "focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none",
      className,
    )}
    {...props}
  >
    {children}
    {badge && badge > 0 ? (
      <span
        aria-hidden
        className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent"
      />
    ) : null}
  </button>
))
IconButton.displayName = "IconButton"

export const TopBar = ({
  user,
  breadcrumb,
  unreadNotifications = 0,
  onOpenCommandPalette,
  onOpenNotifications,
  onSignOut,
  className,
}: TopBarProps) => {
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen)

  return (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 md:px-6",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="inline-flex size-9 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-subtle hover:text-fg md:hidden"
        aria-label="Open navigation"
      >
        <Icon name="drag" size="md" />
      </button>
      <div className="hidden min-w-0 flex-1 md:block">
        <Breadcrumb segments={breadcrumb} />
      </div>
      <div className="flex-1 md:hidden" />
      <div className="flex items-center gap-1">
        <IconButton
          onClick={onOpenCommandPalette}
          aria-label="Search (⌘K)"
          title="Search · ⌘K"
        >
          <Icon name="search" size="md" />
        </IconButton>
        <IconButton
          onClick={onOpenNotifications}
          badge={unreadNotifications}
          aria-label={`Notifications${
            unreadNotifications > 0 ? ` (${unreadNotifications} unread)` : ""
          }`}
        >
          <Icon name="bell" size="md" />
        </IconButton>
        <DropdownRoot>
          <DropdownTrigger asChild>
            <button
              type="button"
              className="ml-1 inline-flex items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
              aria-label="Account menu"
            >
              <Avatar
                name={user?.name}
                src={user?.avatarSrc ?? undefined}
                size="md"
              />
            </button>
          </DropdownTrigger>
          <DropdownPortal>
            <DropdownContent align="end" sideOffset={8}>
              {user ? (
                <>
                  <DropdownLabel>
                    <span className="block body-sm font-medium text-fg">
                      {user.name}
                    </span>
                    {user.email ? (
                      <span className="block body-xs text-fg-muted">
                        {user.email}
                      </span>
                    ) : null}
                  </DropdownLabel>
                  <DropdownSeparator />
                </>
              ) : null}
              <DropdownItem leadingIcon={<Icon name="user" size="sm" />}>
                Profile
              </DropdownItem>
              <DropdownItem leadingIcon={<Icon name="crew" size="sm" />}>
                Team
              </DropdownItem>
              <DropdownItem leadingIcon={<Icon name="settings" size="sm" />}>
                Settings
              </DropdownItem>
              <DropdownSeparator />
              {onSignOut ? (
                <DropdownItem
                  leadingIcon={<Icon name="signOut" size="sm" />}
                  onSelect={onSignOut}
                >
                  Sign out
                </DropdownItem>
              ) : null}
            </DropdownContent>
          </DropdownPortal>
        </DropdownRoot>
      </div>
    </header>
  )
}
