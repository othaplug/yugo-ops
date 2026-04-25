"use client";

import * as React from "react";
import Link from "next/link";
import {
  House,
  List,
  MapPin,
  ChartBar,
  Recycle,
  Receipt,
  SunHorizon,
} from "@phosphor-icons/react";
import { useFloatingScrollExpandNav } from "@/hooks/useFloatingScrollExpandNav";
import { cn } from "@/lib/utils";

const floatPanel =
  "border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)]/95 shadow-[var(--yu3-shadow-lg)] backdrop-blur-md";

type NavSlot = {
  href: string | null;
  shortLabel: string;
  label: string;
  active: boolean;
  disabled: boolean;
};

export type CrewMobileFloatingNavProps = {
  show: boolean;
  pathname: string;
  isDashboard: boolean;
  navigation: NavSlot;
  isStats: boolean;
  isExpense: boolean;
  isEndOfDay: boolean;
  hasActiveBinTasks?: boolean;
};

export function CrewMobileFloatingNav({
  show,
  pathname,
  isDashboard,
  navigation,
  isStats,
  isExpense,
  isEndOfDay,
  hasActiveBinTasks = false,
}: CrewMobileFloatingNavProps) {
  const pathnameString = String(pathname);
  const { scheduleCollapse, handleCompactTap, expanded } =
    useFloatingScrollExpandNav({
      mainElementId: "crew-main",
      pathname: pathnameString,
    });

  const isBinOrders = pathname.startsWith("/crew/bin-orders");

  if (!show) return null;

  const itemClass = (active: boolean, disabled: boolean) =>
    cn(
      "flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 py-1.5 text-[9px] sm:text-[10px] font-bold leading-tight text-[var(--yu3-ink-muted)] transition-colors [font-family:var(--font-body)] uppercase tracking-[0.08em] border-0 outline-none",
      disabled && "text-[var(--yu3-ink-faint)]/50 pointer-events-none",
      !disabled && active && "text-[var(--yu3-wine)] bg-[var(--yu3-wine-tint)]",
      !disabled &&
        !active &&
        "text-[var(--yu3-ink-muted)] hover:bg-[var(--yu3-bg-surface-sunken)]",
    );

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-topbar)]",
        "pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))]",
      )}
    >
      <div className="pointer-events-auto flex w-full max-w-lg flex-col items-stretch sm:max-w-2xl sm:pl-0">
        {expanded ? (
          <div
            id="crew-floating-nav-panel"
            className={cn(
              "w-full max-w-md origin-bottom self-start overflow-hidden rounded-3xl",
              "motion-safe:animate-[yu3-mnav-expand_0.32s_ease-out_both]",
              floatPanel,
            )}
            role="navigation"
            aria-label="Crew app"
          >
            <div className="grid grid-cols-4 gap-0.5 p-1.5 sm:gap-1 sm:p-2">
              <Link
                href="/crew/dashboard"
                className={itemClass(isDashboard, false)}
                onClick={scheduleCollapse}
                aria-current={isDashboard ? "page" : undefined}
              >
                <House
                  size={20}
                  weight={isDashboard ? "fill" : "regular"}
                  className="text-current"
                />
                <span>Dash</span>
              </Link>
              {navigation.disabled || !navigation.href ? (
                <span
                  className={itemClass(false, true)}
                  title="Available when you are en route on a job."
                >
                  <MapPin
                    size={20}
                    weight="regular"
                    className="text-current opacity-40"
                  />
                  <span className="line-clamp-1">{navigation.shortLabel}</span>
                </span>
              ) : (
                <Link
                  href={navigation.href}
                  className={itemClass(navigation.active, false)}
                  onClick={scheduleCollapse}
                  aria-current={navigation.active ? "page" : undefined}
                >
                  <MapPin
                    size={20}
                    weight={navigation.active ? "fill" : "regular"}
                    className="text-current"
                  />
                  <span className="line-clamp-1">{navigation.shortLabel}</span>
                </Link>
              )}
              <Link
                href="/crew/stats"
                className={itemClass(isStats, false)}
                onClick={scheduleCollapse}
                aria-current={isStats ? "page" : undefined}
              >
                <ChartBar
                  size={20}
                  weight={isStats ? "fill" : "regular"}
                  className="text-current"
                />
                <span>Stats</span>
              </Link>
              <Link
                href="/crew/expense"
                className={itemClass(isExpense, false)}
                onClick={scheduleCollapse}
                aria-current={isExpense ? "page" : undefined}
              >
                <Receipt
                  size={20}
                  weight={isExpense ? "fill" : "regular"}
                  className="text-current"
                />
                <span>Exp</span>
              </Link>
              <Link
                href="/crew/end-of-day"
                className={itemClass(isEndOfDay, false)}
                onClick={scheduleCollapse}
                aria-current={isEndOfDay ? "page" : undefined}
              >
                <SunHorizon
                  size={20}
                  weight={isEndOfDay ? "fill" : "regular"}
                  className="text-current"
                />
                <span>EOD</span>
              </Link>
              {hasActiveBinTasks && (
                <Link
                  href="/crew/bin-orders"
                  className={itemClass(isBinOrders, false)}
                  onClick={scheduleCollapse}
                  aria-current={isBinOrders ? "page" : undefined}
                >
                  <Recycle
                    size={20}
                    weight={isBinOrders ? "fill" : "regular"}
                    className="text-current"
                  />
                  <span className="line-clamp-1">Bins</span>
                </Link>
              )}
            </div>
            <form
              action="/api/crew/logout"
              method="POST"
              className="border-t border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface-sunken)]/50 px-2 py-1.5"
            >
              <button
                type="submit"
                className="w-full rounded-2xl py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--yu3-danger)] transition-colors [font-family:var(--font-body)] hover:bg-[var(--yu3-danger-tint)]/60"
                aria-label="Sign out"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <div className="flex w-full justify-start motion-safe:animate-[yu3-mnav-fab_0.28s_ease-out_both]">
            <button
              type="button"
              onClick={handleCompactTap}
              className={cn(
                "crew-keep-round flex h-14 w-14 min-h-14 min-w-14 items-center justify-center rounded-full",
                "border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)]/95 shadow-[var(--yu3-shadow-md)] backdrop-blur-sm",
                "transition-transform active:scale-[0.98]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--yu3-line-subtle)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--yu3-bg-canvas)]",
                isDashboard
                  ? "text-[var(--yu3-ink)]"
                  : "text-[var(--yu3-ink-muted)]",
              )}
              aria-label="Open navigation. Expands on tap or when you scroll."
              aria-expanded={expanded}
              aria-controls="crew-floating-nav-panel"
            >
              {isDashboard ? (
                <House
                  size={24}
                  weight="fill"
                  className="text-current"
                  aria-hidden
                />
              ) : (
                <List
                  size={24}
                  weight="bold"
                  className="text-current"
                  aria-hidden
                />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
