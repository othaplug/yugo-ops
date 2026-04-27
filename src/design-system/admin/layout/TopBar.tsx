"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "../lib/cn";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../primitives/DropdownMenu";
import { Avatar } from "../primitives/Avatar";
import {
  Bell,
  CaretDown,
  Sun,
  Moon,
  User,
  Lock,
  SignOut,
} from "../icons";
import { TopBarInlineSearch } from "./TopBarInlineSearch";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  dispatcher: "Dispatcher",
  coordinator: "Coordinator",
  viewer: "Viewer",
  sales: "Sales",
  crew: "Crew",
  partner: "Partner",
};

export interface TopBarProps {
  userEmail?: string | null;
  userName?: string | null;
  userRole?: string | null;
  notificationCount?: number;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
  onSignOut?: () => void;
  breadcrumbs?: { label: string; href?: string }[];
}

export function TopBar({
  userEmail,
  userName,
  userRole,
  notificationCount = 0,
  theme = "light",
  onToggleTheme,
  onSignOut,
  breadcrumbs,
}: TopBarProps) {
  const router = useRouter();
  return (
    <header
      className={cn(
        "yu3-topbar-float sticky z-[var(--yu3-z-topbar)]",
        "top-0 max-lg:top-0 lg:top-[var(--yu3-sp-4)]",
        "w-full min-w-0",
        "min-h-[var(--yu3-topbar-h)]",
      )}
    >
      <div
        className={cn(
          "flex w-full min-w-0 max-w-[var(--yu3-content-max-w)] mx-auto items-center gap-2 md:gap-3",
          "px-4 md:px-6 pt-3 pb-2 md:pt-2 md:pb-3",
        )}
      >
      <div className="flex min-w-0 shrink-0 items-center gap-2 md:gap-3">
        <nav
          aria-label="Breadcrumb"
          className="hidden md:flex items-center gap-1 text-[13px] text-[var(--yu3-ink-muted)] min-w-0 max-w-[200px] lg:max-w-xs"
        >
          {(breadcrumbs || []).map((crumb, i, arr) => (
            <span
              key={`${crumb.label}-${i}`}
              className="flex items-center gap-1 min-w-0"
            >
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
                    i === arr.length - 1 &&
                      "text-[var(--yu3-ink-strong)] font-medium",
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
      </div>

      <div className="min-w-0 flex-1 flex items-center gap-2 md:gap-3">
        <div className="min-w-0 flex-1 max-w-full">
          <TopBarInlineSearch />
        </div>
        <div className="shrink-0 flex items-center gap-1.5 sm:gap-2 md:gap-3">

        <div
          className="hidden sm:block w-px h-8 bg-[var(--yu3-line)] shrink-0"
          aria-hidden
        />

        <Link
          href="/admin/notifications"
          className={cn(
            "relative inline-flex items-center justify-center h-9 w-9 md:h-10 md:w-10 rounded-full shrink-0",
            "bg-[var(--yu3-topbar-search-bg)] text-[var(--yu3-ink)]",
            "hover:brightness-95",
          )}
          aria-label={
            notificationCount > 0
              ? `Notifications, ${notificationCount} unread`
              : "Notifications"
          }
        >
          <Bell
            size={16}
            weight="regular"
            className="text-[var(--yu3-ink-muted)]"
          />
          {notificationCount > 0 ? (
            <span
              className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[var(--yu3-topbar-search-bg)] z-[1]"
              aria-hidden
            />
          ) : null}
          {notificationCount > 0 ? (
            <span
              className="absolute -top-0.5 -right-0.5 z-[2] min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center"
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
            className={cn(
              "inline-flex items-center gap-2 rounded-full pl-0.5 pr-2 py-0.5",
              "hover:bg-[var(--yu3-bg-surface-sunken)]/60",
            )}
            aria-label="Account menu"
          >
            <Avatar name={userName || userEmail || "User"} size={32} />
            <div className="hidden md:block text-left min-w-0 max-w-[160px]">
              <div className="text-[13px] font-semibold text-[var(--yu3-ink-strong)] leading-tight truncate">
                {userName || userEmail?.split("@")[0] || "Operator"}
              </div>
              {userRole ? (
                <div className="text-[11px] text-[var(--yu3-ink-faint)] leading-tight truncate">
                  {ROLE_LABELS[userRole] ?? userRole}
                </div>
              ) : null}
            </div>
            <CaretDown
              size={12}
              className="hidden md:block shrink-0 text-[var(--yu3-ink-faint)]"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[260px]">
          <div className="flex items-center gap-3 px-3 py-3 border-b border-[var(--yu3-line-subtle)]">
            <Avatar name={userName || userEmail || "User"} size={36} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-[var(--yu3-ink-strong)] truncate leading-tight">
                {userName || userEmail?.split("@")[0] || "Operator"}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {userRole ? (
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--yu3-ink-faint)]">
                    {ROLE_LABELS[userRole] ?? userRole}
                  </span>
                ) : null}
                {userEmail && userRole ? (
                  <span className="text-[var(--yu3-line-strong)]" aria-hidden>
                    ·
                  </span>
                ) : null}
                {userEmail ? (
                  <span className="text-[11px] text-[var(--yu3-ink-faint)] truncate">
                    {userEmail}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="py-1">
            <DropdownMenuItem
              icon={<User size={14} weight="regular" aria-hidden />}
              onSelect={() => router.push("/admin/settings/personal")}
            >
              Account settings
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<Lock size={14} weight="regular" aria-hidden />}
              onSelect={() => router.push("/admin/settings/security")}
            >
              Security
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<Bell size={14} weight="regular" aria-hidden />}
              onSelect={() => router.push("/admin/notifications")}
            >
              Notifications
            </DropdownMenuItem>
          </div>

          <DropdownMenuSeparator />

          {onToggleTheme ? (
            <div className="py-1">
              <button
                type="button"
                onClick={onToggleTheme}
                className={cn(
                  "flex items-center justify-between w-full gap-2",
                  "px-2 py-1.5 rounded-[var(--yu3-r-sm)]",
                  "text-[13px] text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-ink)] hover:bg-[var(--yu3-bg-surface-sunken)]",
                  "transition-colors duration-[var(--yu3-dur-1)] cursor-pointer select-none",
                )}
              >
                <span className="flex items-center gap-2">
                  {theme === "dark" ? (
                    <Sun
                      size={14}
                      weight="regular"
                      className="shrink-0 text-[var(--yu3-ink-muted)]"
                      aria-hidden
                    />
                  ) : (
                    <Moon
                      size={14}
                      weight="regular"
                      className="shrink-0 text-[var(--yu3-ink-muted)]"
                      aria-hidden
                    />
                  )}
                  Appearance
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--yu3-ink-faint)] bg-[var(--yu3-bg-surface-sunken)] border border-[var(--yu3-line-subtle)] rounded-[4px] px-2 py-0.5">
                  {theme}
                </span>
              </button>
            </div>
          ) : null}

          <DropdownMenuSeparator />

          <div className="py-1">
            <DropdownMenuItem
              danger
              icon={<SignOut size={14} weight="regular" aria-hidden />}
              onSelect={onSignOut}
            >
              Sign out
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
        </div>
      </div>
      </div>
    </header>
  );
}
