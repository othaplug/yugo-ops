"use client";

import { useState, useEffect, useMemo } from "react";
import { X, SignOut, List } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeProvider } from "@/app/admin/components/ThemeContext";
import { ToastProvider } from "@/app/admin/components/Toast";
import { Icons } from "@/app/admin/components/SidebarIcons";
import YugoLogo from "@/components/YugoLogo";
import CrewSettingsDropdown from "./CrewSettingsDropdown";
import OfflineBanner from "@/components/ui/OfflineBanner";

const NAV_CORE = [
  { href: "/crew/dashboard", label: "Dashboard", icon: "target" as const },
  { href: "/crew/stats", label: "Stats", icon: "barChart" as const },
  { href: "/crew/expense", label: "Expenses", icon: "dollarSign" as const },
  { href: "/crew/end-of-day", label: "End of Day", icon: "fileText" as const },
];

const SIDEBAR_WIDTH = 220;

export default function CrewShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [crewMember, setCrewMember] = useState<{ name: string; teamName?: string } | null>(null);
  const [hasActiveBinTasks, setHasActiveBinTasks] = useState(false);

  const navItems = useMemo(() => {
    if (!hasActiveBinTasks) return NAV_CORE;
    const bin = { href: "/crew/bin-orders", label: "Bin Tasks", icon: "package" as const };
    return [NAV_CORE[0], bin, ...NAV_CORE.slice(1)];
  }, [hasActiveBinTasks]);

  const isActive = (href: string) => {
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
        if (d?.crewMember) setCrewMember({ name: d.crewMember.name, teamName: d.crewMember.teamName });
        if (typeof d?.hasActiveBinTasks === "boolean") setHasActiveBinTasks(d.hasActiveBinTasks);
      })
      .catch(() => {});
  }, [router, pathname]);

  const initials = (crewMember?.name || "C")
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <ThemeProvider>
      <ToastProvider>
        <div className="flex min-h-screen bg-[var(--bg)]">
          <a
            href="#crew-main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[var(--gold)] focus:text-white focus:font-semibold focus:outline-none"
          >
            Skip to main content
          </a>
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 md:hidden bg-black/40 backdrop-blur-[2px]"
              style={{ left: SIDEBAR_WIDTH }}
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
          )}

          <aside
            className={`
              fixed top-0 left-0 z-50 h-dvh h-screen max-h-[100dvh] flex flex-col overflow-hidden
              glass-sidebar border-r border-[var(--brd)]
              transition-all duration-300 ease-out
              ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
              w-[220px]
            `}
          >
            {/* Logo area */}
            <div className="h-16 px-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <YugoLogo size={18} variant="gold" />
                <span className="text-[9px] font-bold tracking-[2px] uppercase text-[var(--gold)]/60 ml-1">Crew</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden p-2 rounded-lg hover:bg-[var(--card)]/50 transition-colors text-[var(--tx2)]"
                aria-label="Close menu"
              >
                <X size={16} weight="regular" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] overscroll-contain scrollbar-hide">
              <div className="px-3 space-y-1">
                {navItems.map((item) => {
                  const active = isActive(item.href);
                  const IconComp = Icons[item.icon];
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all ${
                        active
                          ? "bg-[var(--gold)]/10 text-[var(--gold)] font-semibold shadow-sm"
                          : "text-[var(--tx2)] hover:bg-[var(--card)] hover:text-[var(--tx)]"
                      }`}
                    >
                      <span className={active ? "text-[var(--gold)]" : "text-[var(--tx3)]"}>
                        <IconComp />
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>

            {/* User area */}
            <div className="shrink-0 px-3 py-3 border-t border-[var(--brd)]">
              <div className="flex items-center gap-3 px-2 mb-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)" }}
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  {crewMember?.name && (
                    <div className="text-[12px] font-semibold text-[var(--tx)] truncate">{crewMember.name}</div>
                  )}
                  {crewMember?.teamName && (
                    <div className="text-[10px] text-[var(--tx3)] truncate">{crewMember.teamName}</div>
                  )}
                </div>
              </div>
              <form action="/api/crew/logout" method="POST" className="w-full">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[11px] font-medium text-[var(--tx3)] hover:bg-[var(--card)] hover:text-[var(--tx)] border border-[var(--brd)] transition-colors"
                >
                  <SignOut size={14} />
                  Sign out
                </button>
              </form>
            </div>
          </aside>

          <div className="hidden md:block shrink-0 w-[220px]" />

          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            {/* Top bar */}
            <div
              className="fixed top-0 right-0 h-14 flex items-center justify-between gap-2 sm:gap-4 z-30 shrink-0 glass-topbar border-b border-[var(--brd)]/60 shadow-[0_1px_0_0_rgba(0,0,0,0.04)] safe-area-top left-0 pl-3 pr-3 sm:px-4 md:left-[220px] md:px-6"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden size-10 flex items-center justify-center rounded-xl hover:bg-[var(--card)] active:bg-[var(--gdim)] transition-colors touch-manipulation text-[var(--tx2)] shrink-0"
                  aria-label="Open menu"
                >
                  <List size={20} />
                </button>
                {isJobPage && (
                  <span className="text-[11px] font-semibold text-[var(--gold)] uppercase tracking-[1.5px]">Active Job</span>
                )}
              </div>
              <div className="flex-shrink-0">
                <CrewSettingsDropdown />
              </div>
            </div>

            <main id="crew-main" key={pathname} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 admin-main-offset tab-content pb-[calc(64px+env(safe-area-inset-bottom,0px))] md:pb-0">
              {children}
            </main>
          </div>

          {/* Mobile bottom navigation */}
          <nav
            className="md:hidden fixed bottom-0 left-0 right-0 z-[var(--z-topbar)] border-t border-[var(--brd)]/60 flex items-stretch bg-[var(--card)]/95 backdrop-blur-md safe-area-bottom"
            aria-label="Main navigation"
          >
            {navItems.map((item) => {
              const active = isActive(item.href);
              const IconComp = Icons[item.icon];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex-1 flex flex-col items-center justify-end gap-1 pb-3 pt-2 min-h-[56px] text-[10px] font-semibold transition-colors touch-manipulation ${
                    active ? "text-[var(--gold)]" : "text-[var(--tx3)]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className={active ? "text-[var(--gold)]" : "text-[var(--tx3)]"}>
                    <IconComp />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <OfflineBanner />
      </ToastProvider>
    </ThemeProvider>
  );
}
