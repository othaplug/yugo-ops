"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { CaretLeft, CaretRight, List, X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeProvider } from "@/app/admin/components/ThemeContext";
import { ToastProvider } from "@/app/admin/components/Toast";
import { Icons } from "@/app/admin/components/SidebarIcons";
import YugoLogo from "@/components/YugoLogo";
import CrewSettingsDropdown from "./CrewSettingsDropdown";
import OfflineBanner from "@/components/ui/OfflineBanner";
import { CrewImmersiveNavContext } from "./CrewImmersiveNavContext";

const NAV_CORE = [
  { href: "/crew/dashboard", label: "Dashboard", icon: "target" as const },
  { href: "/crew/stats", label: "Stats", icon: "barChart" as const },
  { href: "/crew/expense", label: "Expenses", icon: "dollarSign" as const },
  { href: "/crew/end-of-day", label: "End of Day", icon: "fileText" as const },
];

type ShellNavItem =
  | { href: string; label: string; icon: keyof typeof Icons }
  | { href: string | null; label: string; icon: keyof typeof Icons; navigation: true };

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
    const navItem: ShellNavItem = { href: navTargetPath, label: "Navigation", icon: "navigationArrow", navigation: true };
    if (!hasActiveBinTasks) return [NAV_CORE[0], navItem, ...NAV_CORE.slice(1)];
    const bin: ShellNavItem = { href: "/crew/bin-orders", label: "Bin Tasks", icon: "recycle" };
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
    <ThemeProvider>
      <ToastProvider>
        <CrewImmersiveNavContext.Provider value={immersiveNavApi}>
        <div className="flex min-h-screen bg-[var(--bg)]">
          <a
            href="#crew-main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[var(--gold)] focus:text-white focus:font-semibold focus:outline-none"
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
            {/* Logo bar — h-14 matches fixed topbar so the header row lines up with admin */}
            <div className="h-14 flex items-center shrink-0 bg-transparent border-b border-[var(--brd)]/20">
              {/* Rail: expand only */}
              <div
                className={`hidden md:flex w-full items-center justify-center transition-all duration-200 ${sidebarCollapsed ? "" : "opacity-0 pointer-events-none absolute"}`}
              >
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(false)}
                  className="p-2 hover:bg-[var(--card)]/50 transition-colors text-[var(--tx3)] hover:text-[var(--tx2)]"
                  title="Expand sidebar"
                  aria-label="Expand sidebar"
                >
                  <CaretRight size={15} weight="regular" className="text-current" aria-hidden />
                </button>
              </div>
              {/* Full: logo + collapse / mobile close */}
              <div
                className={`flex items-center justify-between w-full px-4 transition-all duration-200 ${sidebarCollapsed ? "md:opacity-0 md:pointer-events-none" : ""}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <YugoLogo size={18} variant="gold" />
                  <span className="text-[9px] font-bold tracking-[2px] uppercase text-[var(--gold)]/60 truncate">
                    Crew
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed(true)}
                    className="hidden md:flex p-2 hover:bg-[var(--card)]/50 transition-colors text-[var(--tx3)] hover:text-[var(--tx2)]"
                    aria-label="Collapse sidebar"
                    title="Collapse sidebar"
                  >
                    <CaretLeft size={15} weight="regular" className="text-current" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="md:hidden p-2 hover:bg-[var(--card)]/50 transition-colors text-[var(--tx2)]"
                    aria-label="Close menu"
                  >
                    <X size={15} weight="regular" className="text-current" aria-hidden />
                  </button>
                </div>
              </div>
            </div>

            {/* Navigation — same lift + left accent pattern as admin sidebar */}
            <nav
              className={`icon-glow flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] overscroll-contain scrollbar-hide ${sidebarCollapsed ? "md:hidden" : ""}`}
            >
              <div className="space-y-0.5">
                {navItems.map((item) => {
                  const active = isActive(item);
                  const IconComp = Icons[item.icon];
                  const key = "navigation" in item && item.navigation ? "navigation" : item.href;
                  const disabled = "navigation" in item && item.navigation && !item.href;
                  const content = (
                    <>
                      <span className={`relative shrink-0 ${active ? "text-[var(--gold)]" : "text-[var(--tx3)]"}`}>
                        <IconComp />
                      </span>
                      <span className={`truncate ${active ? "font-bold" : ""}`}>{item.label}</span>
                    </>
                  );
                  const className = `sidebar-nav-lift flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-[12px] font-medium border-l-2 -ml-px ${
                    active
                      ? "bg-[var(--gdim)] text-[var(--gold)] border-l-[var(--gold)] font-semibold"
                      : disabled
                        ? "text-[var(--tx3)]/40 border-l-transparent cursor-not-allowed opacity-70"
                        : "text-[var(--tx2)] hover:bg-[var(--gdim)]/60 hover:text-[var(--tx)] border-l-transparent"
                  }`;
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
                const IconComp = Icons[item.icon];
                const key = "navigation" in item && item.navigation ? "navigation" : item.href;
                const disabled = "navigation" in item && item.navigation && !item.href;
                const railClass = `relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors mx-auto ${
                  active
                    ? "bg-[var(--gdim)] text-[var(--gold)]"
                    : disabled
                      ? "text-[var(--tx3)]/40 cursor-not-allowed opacity-70"
                      : "text-[var(--tx3)] hover:bg-[var(--gdim)]/60 hover:text-[var(--tx2)]"
                }`;
                if (disabled) {
                  return (
                    <span
                      key={key}
                      className={railClass}
                      title="When you’re en route on an active job, open navigation here."
                      aria-disabled="true"
                    >
                      <IconComp />
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
                    <IconComp />
                  </Link>
                );
              })}
            </nav>
          </aside>

          <div
            className={`hidden md:block shrink-0 transition-all duration-300 ${immersiveNav ? "hidden" : ""} ${sidebarCollapsed ? "w-14" : "w-[220px]"}`}
          />

          <div
            className={`flex-1 flex flex-col min-w-0 min-h-0 ${immersiveNav ? "" : "admin-main-offset"}`}
          >
            {/* Top bar — h-14 + border matches admin shell */}
            <div
              className={`fixed top-0 right-0 h-14 flex items-center justify-between gap-2 sm:gap-4 z-30 shrink-0 glass-topbar border-b border-[var(--brd)]/50 shadow-[0_1px_0_0_rgba(0,0,0,0.04)] safe-area-top transition-all duration-300 left-0 pl-3 pr-3 sm:px-4 md:px-6 ${
                immersiveNav ? "hidden" : ""
              } ${sidebarCollapsed ? "md:left-14" : "md:left-[220px]"}
              `}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden size-9 flex items-center justify-center hover:bg-[var(--card)] active:bg-[var(--gdim)] transition-colors touch-manipulation text-[var(--tx2)] shrink-0 -ml-0.5"
                  aria-label="Open menu"
                >
                  <List size={20} weight="regular" className="text-current" aria-hidden />
                </button>
                {isJobPage && (
                  <span className="text-[11px] font-semibold text-[var(--gold)] uppercase tracking-[1.5px]">Active Job</span>
                )}
              </div>
              <div className="flex-shrink-0">
                <CrewSettingsDropdown />
              </div>
            </div>

            <main
              id="crew-main"
              key={pathname}
              className={`flex-1 overflow-y-auto overflow-x-hidden min-h-0 tab-content ${
                immersiveNav ? "pb-0" : "pb-[calc(64px+env(safe-area-inset-bottom,0px))] md:pb-0"
              }`}
            >
              {children}
            </main>
          </div>

          {/* Mobile bottom navigation */}
          <nav
            className={`md:hidden fixed bottom-0 left-0 right-0 z-[var(--z-topbar)] glass-topbar border-t border-[var(--brd)]/50 flex items-stretch safe-area-bottom ${
              immersiveNav ? "hidden" : ""
            }`}
            aria-label="Main navigation"
          >
            {navItems.map((item) => {
              const active = isActive(item);
              const IconComp = Icons[item.icon];
              const key = "navigation" in item && item.navigation ? "navigation" : item.href;
              const disabled = "navigation" in item && item.navigation && !item.href;
              const tabClass = `flex-1 flex flex-col items-center justify-end gap-1 pb-3 pt-2 min-h-[56px] text-[10px] font-semibold transition-colors touch-manipulation ${
                active ? "text-[var(--gold)]" : disabled ? "text-[var(--tx3)]/35 pointer-events-none" : "text-[var(--tx3)]"
              }`;
              const iconWrap = (
                <span className={active ? "text-[var(--gold)]" : disabled ? "text-[var(--tx3)]/35" : "text-[var(--tx3)]"}>
                  <IconComp />
                </span>
              );
              if (disabled) {
                return (
                  <span key={key} className={tabClass} aria-hidden title="Available when you’re en route on a job.">
                    {iconWrap}
                    {item.label}
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
                  {iconWrap}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        </CrewImmersiveNavContext.Provider>
        <OfflineBanner />
      </ToastProvider>
    </ThemeProvider>
  );
}
