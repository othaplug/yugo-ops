"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ToastProvider } from "@/app/admin/components/Toast";
import YugoLogo from "@/components/YugoLogo";
import CrewSignOutFooter from "./CrewSignOutFooter";
import OfflineBanner from "@/components/ui/OfflineBanner";
import { CrewImmersiveNavContext } from "./CrewImmersiveNavContext";

const NAV_CORE = [
  {
    href: "/crew/dashboard",
    label: "Dashboard",
    shortLabel: "Dash",
    abbrev: "DB",
  },
  {
    href: "/crew/stats",
    label: "Stats",
    shortLabel: "Stats",
    abbrev: "ST",
  },
  {
    href: "/crew/expense",
    label: "Expenses",
    shortLabel: "Exp",
    abbrev: "EX",
  },
  {
    href: "/crew/end-of-day",
    label: "End of day",
    shortLabel: "EOD",
    abbrev: "ED",
  },
] as const;

type ShellNavItem =
  | {
      href: string;
      label: string;
      shortLabel: string;
      abbrev: string;
    }
  | {
      href: string | null;
      label: string;
      shortLabel: string;
      abbrev: string;
      navigation: true;
    };

const SIDEBAR_WIDTH = 220;
const CREW_SIDEBAR_COLLAPSED_KEY = "yugo_crew_sidebar_collapsed";

export default function CrewShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(CREW_SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [hasActiveBinTasks, setHasActiveBinTasks] = useState(false);
  const [navTargetPath, setNavTargetPath] = useState<string | null>(null);
  const [immersiveNav, setImmersiveNavState] = useState(false);
  const setImmersiveNav = useCallback((v: boolean) => {
    setImmersiveNavState(v);
  }, []);
  const immersiveNavApi = useMemo(
    () => ({ immersiveNav, setImmersiveNav }),
    [immersiveNav, setImmersiveNav]
  );

  const navItems: ShellNavItem[] = useMemo(() => {
    const navItem: ShellNavItem = {
      href: navTargetPath,
      label: "Navigation",
      shortLabel: "Nav",
      abbrev: "NV",
      navigation: true,
    };
    if (!hasActiveBinTasks) return [NAV_CORE[0], navItem, ...NAV_CORE.slice(1)];
    const bin: ShellNavItem = {
      href: "/crew/bin-orders",
      label: "Bin tasks",
      shortLabel: "Bins",
      abbrev: "BT",
    };
    return [NAV_CORE[0], navItem, bin, ...NAV_CORE.slice(1)];
  }, [hasActiveBinTasks, navTargetPath]);

  const isActive = (item: ShellNavItem) => {
    if ("navigation" in item && item.navigation) {
      if (!item.href) return false;
      return pathname === item.href.split("?")[0];
    }
    const href = item.href;
    if (!href) return false;
    if (href === "/crew/dashboard") {
      return pathname === "/crew/dashboard" || pathname.startsWith("/crew/dashboard/job/");
    }
    if (href === "/crew/stats") return pathname.startsWith("/crew/stats");
    if (href === "/crew/bin-orders") return pathname.startsWith("/crew/bin-orders");
    return pathname.startsWith(href);
  };
  const isJobPage = pathname.startsWith("/crew/dashboard/job/");

  useEffect(() => {
    const load = () => {
      fetch("/api/crew/dashboard")
        .then((r) => {
          if (r.status === 401) {
            router.replace("/crew/login");
            return null;
          }
          return r.json();
        })
        .then((d) => {
          if (typeof d?.hasActiveBinTasks === "boolean") setHasActiveBinTasks(d.hasActiveBinTasks);
        })
        .catch(() => {});
    };
    load();
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      load();
    }, 20_000);
    return () => clearInterval(id);
  }, [router, pathname]);

  useEffect(() => {
    fetch("/api/crew/nav-target")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const p = d && typeof d.path === "string" && d.path.length > 0 ? d.path : null;
        setNavTargetPath(p);
      })
      .catch(() => setNavTargetPath(null));
  }, [pathname]);

  useEffect(() => {
    try {
      localStorage.setItem(CREW_SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  return (
    <ToastProvider>
      <CrewImmersiveNavContext.Provider value={immersiveNavApi}>
        <div className="flex h-dvh max-h-dvh min-h-0 w-full overflow-hidden bg-[var(--bg)]">
          <a
            href="#crew-main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#2C3E2D] focus:text-white focus:font-semibold focus:outline-none"
          >
            Skip to main content
          </a>
          {sidebarOpen && !immersiveNav && (
            <div
              className="fixed inset-0 z-40 md:hidden bg-black/35"
              style={{ left: `${SIDEBAR_WIDTH}px` }}
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
          )}

          <aside
            className={`
              fixed top-0 left-0 z-50 h-dvh h-screen max-h-[100dvh] flex flex-col overflow-hidden
              glass-sidebar border-r border-[var(--brd)]/50
              transition-all duration-300 ease-out
              ${immersiveNav ? "hidden" : ""}
              ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
              ${sidebarCollapsed ? "md:w-14 w-[220px]" : "w-[220px]"}
            `}
          >
            <div className="h-12 flex items-center shrink-0 bg-white/35 border-b border-[#5C1A33]/[0.1]">
              {/* Rail: expand only */}
              <div
                className={`hidden md:flex w-full items-center justify-center transition-all duration-200 ${sidebarCollapsed ? "" : "opacity-0 pointer-events-none absolute"}`}
              >
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(false)}
                  className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--tx2)] hover:bg-[var(--card)]/50 hover:text-[var(--tx)] transition-colors rounded-lg"
                  title="Expand sidebar"
                  aria-label="Expand sidebar"
                >
                  Open
                </button>
              </div>
              {/* Full: logo + collapse / mobile close */}
              <div
                className={`flex items-center justify-between w-full px-4 transition-all duration-200 ${sidebarCollapsed ? "md:opacity-0 md:pointer-events-none" : ""}`}
              >
                <YugoLogo size={21} variant="wine" className="crew-sidebar-wordmark shrink-0" />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed(true)}
                    className="hidden md:flex px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--tx3)] hover:bg-[var(--card)]/50 hover:text-[var(--tx2)] rounded-lg transition-colors"
                    aria-label="Collapse sidebar"
                    title="Collapse sidebar"
                  >
                    Hide
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="md:hidden px-2 py-1 text-[11px] font-semibold text-[var(--tx2)] hover:bg-[var(--card)]/50 rounded-lg transition-colors"
                    aria-label="Close menu"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>

            {isJobPage ? (
              <div
                className={`shrink-0 px-4 py-2.5 mx-2 mt-2 rounded-xl bg-[#5C1A33]/[0.07] border border-[#5C1A33]/[0.12] ${sidebarCollapsed ? "md:hidden" : ""}`}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5C1A33] [font-family:var(--font-body)]">
                  Active job
                </p>
              </div>
            ) : null}

            {/* Navigation — same lift + left accent pattern as admin sidebar */}
            <nav
              className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] overscroll-contain scrollbar-hide ${sidebarCollapsed ? "md:hidden" : ""}`}
            >
              <div className="space-y-0.5">
                {navItems.map((item) => {
                  const active = isActive(item);
                  const key = "navigation" in item && item.navigation ? "navigation" : item.href;
                  const disabled = "navigation" in item && item.navigation && !item.href;
                  const content = (
                    <span className="truncate uppercase text-[10px] font-bold tracking-[0.14em] leading-none pl-0.5">
                      {item.label}
                    </span>
                  );
                  const className = `crew-sidebar-nav-item sidebar-nav-lift flex items-center px-3.5 py-2.5 mx-2 rounded-xl border-l-2 -ml-px border-transparent [font-family:var(--font-body)] ${
                    active ? "is-active" : ""
                  } ${disabled ? "is-disabled" : ""}`;
                  if (disabled) {
                    return (
                      <span key={key} className={className} title="When you’re en route on an active job, open navigation here.">
                        {content}
                      </span>
                    );
                  }
                  return (
                    <Link
                      key={key}
                      href={item.href!}
                      onClick={() => setSidebarOpen(false)}
                      className={className}
                    >
                      {content}
                    </Link>
                  );
                })}
              </div>
            </nav>

            {/* Rail nav — desktop collapsed */}
            <nav
              className={`hidden ${sidebarCollapsed ? "md:flex" : ""} flex-col flex-1 min-h-0 overflow-y-auto py-3 pb-4 gap-0.5 items-center overscroll-contain scrollbar-hide`}
              aria-label="Main navigation"
            >
              {navItems.map((item) => {
                const active = isActive(item);
                const key = "navigation" in item && item.navigation ? "navigation" : item.href;
                const disabled = "navigation" in item && item.navigation && !item.href;
                const railClass = `crew-sidebar-rail-item relative flex items-center justify-center w-10 min-h-10 py-1.5 rounded-xl transition-colors mx-auto [font-family:var(--font-body)] ${
                  active ? "is-active" : ""
                } ${disabled ? "is-disabled" : ""}`;
                const railMark = (
                  <span
                    className={`text-[9px] font-bold tracking-[0.06em] leading-tight text-center px-0.5 ${
                      active
                        ? "text-[#5C1A33]"
                        : disabled
                          ? "text-[var(--tx3)]/40"
                          : "text-[var(--tx3)]"
                    }`}
                  >
                    {item.abbrev}
                  </span>
                );
                if (disabled) {
                  return (
                    <span
                      key={key}
                      className={railClass}
                      title="When you’re en route on an active job, open navigation here."
                      aria-disabled="true"
                    >
                      {railMark}
                    </span>
                  );
                }
                return (
                  <Link
                    key={key}
                    href={item.href!}
                    onClick={() => setSidebarOpen(false)}
                    className={railClass}
                    title={item.label}
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                  >
                    {railMark}
                  </Link>
                );
              })}
            </nav>

            <div
              className={`shrink-0 border-t border-[var(--brd)]/40 bg-white/25 py-2 ${
                sidebarCollapsed ? "flex justify-center px-0 pb-2" : "px-0 pb-2"
              }`}
            >
              <CrewSignOutFooter compact={sidebarCollapsed} />
            </div>
          </aside>

          <div
            className={`hidden md:block shrink-0 transition-all duration-300 ${immersiveNav ? "hidden" : ""} ${sidebarCollapsed ? "w-14" : "w-[220px]"}`}
          />

          {!immersiveNav && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className={`crew-keep-round md:hidden fixed z-40 min-h-10 px-3 flex items-center justify-center rounded-xl bg-white/90 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--tx2)] shadow-[0_2px_16px_rgba(44,62,45,0.12)] border border-[var(--brd)]/60 hover:bg-white hover:text-[var(--tx)] active:scale-[0.98] transition-colors left-3 ${
                sidebarOpen ? "pointer-events-none opacity-0" : "opacity-100"
              }`}
              style={{ top: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
              aria-label="Open menu"
            >
              Menu
            </button>
          )}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <main
              id="crew-main"
              key={pathname}
              className={`relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y tab-content ${
                immersiveNav
                  ? "pt-0 pb-0"
                  : "max-md:pt-[calc(var(--app-chrome-h)_+_env(safe-area-inset-top,0px))] md:pt-[env(safe-area-inset-top,0px)] pb-[calc(var(--admin-mobile-nav-bar)_+_env(safe-area-inset-bottom,0px))] md:pb-0"
              }`}
            >
              {children}
            </main>
          </div>

          {/* Mobile bottom navigation */}
          <nav
            className={`md:hidden fixed bottom-0 left-0 right-0 z-[var(--z-topbar)] glass-topbar border-t border-[var(--brd)]/50 flex items-stretch ${
              immersiveNav ? "hidden" : ""
            }`}
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            aria-label="Main navigation"
          >
            {navItems.map((item) => {
              const active = isActive(item);
              const key = "navigation" in item && item.navigation ? "navigation" : item.href;
              const disabled = "navigation" in item && item.navigation && !item.href;
              const tabClass = `flex-1 flex flex-col items-center justify-center px-0.5 pb-2.5 pt-2.5 min-h-[52px] text-[11px] font-bold uppercase tracking-[0.08em] leading-tight text-center transition-colors touch-manipulation [font-family:var(--font-body)] ${
                active
                  ? "text-[#5C1A33]"
                  : disabled
                    ? "text-[var(--tx2)]/40 pointer-events-none"
                    : "text-[var(--tx2)]"
              }`;
              const label = (
                <span className="max-w-full line-clamp-2">{item.shortLabel}</span>
              );
              if (disabled) {
                return (
                  <span key={key} className={tabClass} aria-hidden title="Available when you’re en route on a job.">
                    {label}
                  </span>
                );
              }
              return (
                <Link
                  key={key}
                  href={item.href!}
                  className={tabClass}
                  aria-current={active ? "page" : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        </CrewImmersiveNavContext.Provider>
        <OfflineBanner />
    </ToastProvider>
  );
}
