"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SIDEBAR_SECTIONS,
  ROLE_LEVEL,
  ALL_NAV_HREFS,
  type NavItem,
} from "./nav";
import { cn } from "../lib/cn";
import { Avatar } from "../primitives/Avatar";
import { Tooltip } from "../primitives/Tooltip";
import { CaretLeft, CaretRight, Sparkle } from "../icons";
import YugoLogo from "@/components/YugoLogo";

export interface SidebarBadges {
  quotes?: number;
  changeRequests?: number;
}

export interface SidebarProps {
  role: string;
  isSuperAdmin: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate?: () => void;
  user: { email?: string | null; full_name?: string | null } | null;
  badges?: SidebarBadges;
  workspaceLabel?: string;
  workspacePlan?: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.activePath) return item.activePath(pathname);
  const { href } = item;
  if (href === "/admin") return pathname === "/admin";
  if (!pathname.startsWith(href)) return false;
  const more = ALL_NAV_HREFS.filter(
    (h) => h !== href && h.startsWith(`${href}/`),
  );
  if (more.length === 0) return true;
  if (pathname === href || pathname === `${href}/`) return true;
  return !more.some((l) => pathname === l || pathname.startsWith(`${l}/`));
}

function InsetRule({ className }: { className?: string }) {
  return (
    <div
      className={cn("mx-3 h-px bg-[var(--yu3-line-subtle)]", className)}
      role="separator"
      aria-hidden
    />
  );
}

function NavRow({
  item,
  active,
  collapsed,
  badge,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  const Icon = item.Icon;
  const row = (
    <Link
      href={item.href}
      onClick={onNavigate}
      data-active={active ? "true" : undefined}
      className={cn(
        "relative flex items-center gap-2.5 text-[13px] transition-colors duration-[var(--yu3-dur-1)]",
        collapsed
          ? "justify-center mx-2 h-9 w-9 rounded-full"
          : "mx-2 px-3 h-9 rounded-[var(--yu3-r-md)]",
        collapsed
          ? active
            ? "bg-[var(--yu3-wine-wash)] text-[var(--yu3-ink-strong)] font-semibold"
            : "text-[var(--yu3-ink-muted)] font-medium hover:bg-[var(--yu3-bg-surface-sunken)] hover:text-[var(--yu3-ink)]"
          : active
            ? "bg-[color-mix(in_srgb,var(--yu3-wine)_20%,transparent)] text-[var(--yu3-ink-strong)] font-semibold"
            : "text-[var(--yu3-ink-muted)] font-medium hover:bg-[color-mix(in_srgb,var(--yu3-wine)_12%,transparent)] hover:text-[var(--yu3-ink)]",
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
  );
  if (collapsed) {
    return (
      <Tooltip side="right" content={item.label}>
        {row}
      </Tooltip>
    );
  }
  return row;
}

export function Sidebar({
  role,
  isSuperAdmin,
  collapsed,
  onToggleCollapse,
  onNavigate,
  user,
  badges,
  workspacePlan = "Operator",
  isMobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname() || "/admin";
  const userLevel = ROLE_LEVEL[role] ?? 0;

  const visibleSections = SIDEBAR_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      const needed = ROLE_LEVEL[item.minRole ?? "viewer"] ?? 0;
      return userLevel >= needed || isSuperAdmin;
    }),
  })).filter((s) => s.items.length > 0);

  return (
    <>
      <aside
        aria-label="Admin sidebar"
        data-mobile-open={isMobileOpen ? "true" : undefined}
        className={cn(
          "group flex flex-col z-[var(--yu3-z-sidebar)] overflow-hidden",
          "bg-[var(--yu3-bg-surface)]",
          "shadow-[var(--yu3-shadow-md)]",
          "border border-[var(--yu3-line-subtle)]",
          "lg:h-[calc(100dvh-var(--yu3-sp-4)*2)]",
          "lg:sticky lg:top-[var(--yu3-sp-4)]",
          "lg:shrink-0",
          collapsed
            ? "max-lg:w-[min(272px,calc(100vw-2rem))] lg:w-[var(--yu3-sidebar-rail-w)]"
            : "max-lg:w-[min(272px,calc(100vw-2rem))] lg:w-[var(--yu3-sidebar-w)]",
          collapsed ? "lg:rounded-[var(--yu3-r-pill)]" : "lg:rounded-[2rem]",
          "max-lg:fixed max-lg:left-4 max-lg:top-4",
          "max-lg:h-[calc(100dvh-var(--yu3-sp-4)*2)]",
          "max-lg:rounded-[1.5rem] max-lg:shadow-2xl",
          "max-lg:transition-transform max-lg:duration-[var(--yu3-dur-2)]",
          isMobileOpen
            ? "max-lg:translate-x-0"
            : "max-lg:-translate-x-[calc(100%+2rem)]",
        )}
      >
        {/* Top brand — wordmark (symbol + ugo); collapsed: symbol only */}
        <div
          className={cn(
            "flex flex-col items-center pt-4 pb-2 shrink-0",
            !collapsed && "px-2",
          )}
        >
          <div
            className={cn(
              "flex w-full",
              collapsed
                ? "flex-col items-center gap-1.5 px-1"
                : "flex-row items-center justify-between gap-2 px-2",
            )}
          >
            <div
              className={cn(
                "flex items-center min-w-0",
                collapsed ? "justify-center" : "gap-2 flex-1",
              )}
            >
              {!collapsed ? (
                <div className="min-w-0">
                  <YugoLogo
                    size={15}
                    variant="auto"
                    hidePlus={false}
                    className="min-w-0"
                  />
                  <div className="text-[11px] text-[var(--yu3-ink-faint)] leading-tight truncate">
                    {workspacePlan}
                  </div>
                </div>
              ) : (
                <YugoLogo
                  size={32}
                  variant="auto"
                  symbolOnly
                  className="shrink-0"
                />
              )}
            </div>
            {collapsed ? (
              <Tooltip side="right" content="Expand sidebar">
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="hidden lg:inline-flex items-center justify-center h-8 w-8 rounded-lg bg-[var(--yu3-bg-surface-sunken)] text-[var(--yu3-ink-muted)] border border-[var(--yu3-line-subtle)] hover:bg-[var(--yu3-wine-tint)] hover:text-[var(--yu3-wine)] transition-colors"
                  aria-label="Expand sidebar"
                >
                  <CaretRight size={16} weight="regular" />
                </button>
              </Tooltip>
            ) : (
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={onMobileClose}
                  className="lg:hidden inline-flex items-center justify-center h-8 w-8 rounded-lg text-[var(--yu3-ink-muted)] hover:bg-[var(--yu3-bg-surface-sunken)]"
                  aria-label="Close sidebar"
                >
                  <CaretLeft size={16} />
                </button>
                <Tooltip side="right" content="Collapse sidebar">
                  <button
                    type="button"
                    onClick={onToggleCollapse}
                    className="hidden lg:inline-flex items-center justify-center h-8 w-8 rounded-lg text-[var(--yu3-ink-muted)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface-sunken)] hover:bg-[var(--yu3-wine-tint)] hover:text-[var(--yu3-wine)] transition-colors"
                    aria-label="Collapse sidebar"
                  >
                    <CaretLeft size={16} weight="regular" />
                  </button>
                </Tooltip>
              </div>
            )}
          </div>
          <InsetRule className="mt-3" />
        </div>

        {/* Main nav (scroll) */}
        <nav className="flex-1 min-h-0 overflow-y-auto py-2 flex flex-col">
          {visibleSections.map((section) => (
            <div key={section.label ?? "__settings"} className="mb-3">
              {!collapsed && section.label ? (
                <div className="yu3-t-eyebrow px-4 mb-1.5">{section.label}</div>
              ) : null}
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const badge =
                    item.badgeKey === "quotes"
                      ? badges?.quotes
                      : item.badgeKey === "changeRequests"
                        ? badges?.changeRequests
                        : undefined;
                  return (
                    <NavRow
                      key={`${section.label ?? "s"}-${item.href}-${item.label}`}
                      item={item}
                      active={isActive(pathname, item)}
                      collapsed={collapsed}
                      badge={badge}
                      onNavigate={onNavigate}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Account */}
        <div
          className={cn(
            "mt-auto border-t border-[var(--yu3-line-subtle)] py-2 shrink-0",
            "flex flex-col items-center gap-1.5",
            collapsed ? "px-0 pb-3" : "px-2 pb-3",
          )}
        >
          {!collapsed ? (
            <div className="w-full px-2 pt-1">
              <div className="flex items-center gap-2.5 p-2 rounded-[var(--yu3-r-md)] hover:bg-[var(--yu3-bg-surface-sunken)]">
                <Avatar
                  name={user?.full_name || user?.email || "User"}
                  size={28}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-[var(--yu3-ink-strong)] truncate">
                    {user?.full_name ||
                      user?.email?.split("@")[0] ||
                      "Operator"}
                  </div>
                  <div className="text-[11px] text-[var(--yu3-ink-faint)] truncate">
                    {user?.email || ""}
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-[var(--yu3-ink-muted)] leading-snug flex items-center gap-1.5 mt-1 px-1">
                <Sparkle size={10} weight="regular" className="shrink-0" />
                Ask the assistant for lead intel, quotes, and crew availability.
              </p>
            </div>
          ) : (
            <Tooltip
              side="right"
              content={user?.full_name || user?.email || "Account"}
            >
              <div className="pt-0.5">
                <Avatar
                  name={user?.full_name || user?.email || "User"}
                  size={32}
                  className="ring-1 ring-[var(--yu3-line-subtle)]"
                />
              </div>
            </Tooltip>
          )}
        </div>
      </aside>

      {isMobileOpen ? (
        <button
          type="button"
          onClick={onMobileClose}
          aria-label="Close sidebar"
          className="lg:hidden fixed inset-0 z-[calc(var(--yu3-z-sidebar)-1)] bg-[var(--yu3-bg-overlay)]"
        />
      ) : null}
    </>
  );
}
