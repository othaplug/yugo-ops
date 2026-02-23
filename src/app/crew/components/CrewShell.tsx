"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeProvider } from "@/app/admin/components/ThemeContext";
import { ToastProvider } from "@/app/admin/components/Toast";
import { Icons } from "@/app/admin/components/SidebarIcons";

const CREW_PAGE_TITLES: Record<string, { title: string; subtitle: string; hideHeaderTitle?: boolean }> = {
  "/crew/dashboard": { title: "Dashboard", subtitle: "", hideHeaderTitle: true },
  "/crew/expense": { title: "Expenses", subtitle: "", hideHeaderTitle: true },
  "/crew/end-of-day": { title: "End of Day", subtitle: "", hideHeaderTitle: true },
};
function getCrewPageTitle(pathname: string): { title: string; subtitle: string; hideHeaderTitle?: boolean } {
  if (CREW_PAGE_TITLES[pathname]) return CREW_PAGE_TITLES[pathname];
  if (pathname.startsWith("/crew/dashboard/job/")) return { title: "Job", subtitle: "", hideHeaderTitle: true };
  return { title: "Crew Portal", subtitle: "", hideHeaderTitle: true };
}

const SIDEBAR_WIDTH = 220;

export default function CrewShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [crewMember, setCrewMember] = useState<{ name: string } | null>(null);

  const { title, subtitle, hideHeaderTitle } = getCrewPageTitle(pathname);
  const isActive = (href: string) => href === "/crew/dashboard" ? pathname === "/crew/dashboard" : pathname.startsWith(href);

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
        if (d?.crewMember) setCrewMember({ name: d.crewMember.name });
      })
      .catch(() => {});
  }, [router]);

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
              className="fixed inset-0 z-40 md:hidden bg-black/35"
              style={{ left: SIDEBAR_WIDTH }}
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
          )}

          <aside
            className={`
              fixed top-0 left-0 z-50 h-dvh h-screen max-h-[100dvh] flex flex-col overflow-hidden
              bg-[var(--bg2)] border-r border-[var(--brd)]
              transition-all duration-300 ease-out
              ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
              w-[220px]
            `}
          >
            <div className="h-14 px-4 flex items-center justify-between shrink-0 bg-transparent">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-[rgba(201,169,98,0.06)] backdrop-blur-xl border border-[rgba(201,169,98,0.35)] text-[var(--gold)] font-hero text-[13px] font-semibold tracking-[3px]">
                  YUGO
                </span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden p-2 rounded-lg hover:bg-[var(--card)]/50 transition-colors text-[var(--tx2)]"
                aria-label="Close menu"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] overscroll-contain scrollbar-hide">
              <div className="mb-4">
                <div className="text-[9px] font-semibold tracking-[1.2px] uppercase text-[var(--tx3)] px-4 py-2 font-hero">
                  Crew
                </div>
                <div className="space-y-0.5">
                  <Link
                    href="/crew/dashboard"
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 text-[12px] font-medium transition-all duration-150 border-l-2 -ml-px ${
                      isActive("/crew/dashboard")
                        ? "bg-[var(--gdim)] text-[var(--gold)] border-l-[var(--gold)] font-semibold"
                        : "text-[var(--tx2)] hover:bg-[var(--gdim)]/50 hover:text-[var(--tx)] border-l-transparent"
                    }`}
                  >
                    <span className={pathname === "/crew/dashboard" ? "text-[var(--gold)]" : "text-[var(--tx3)]"}>
                      <Icons.target />
                    </span>
                    <span>Dashboard</span>
                  </Link>
                  <Link
                    href="/crew/expense"
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 text-[12px] font-medium transition-all duration-150 border-l-2 -ml-px ${
                      isActive("/crew/expense")
                        ? "bg-[var(--gdim)] text-[var(--gold)] border-l-[var(--gold)] font-semibold"
                        : "text-[var(--tx2)] hover:bg-[var(--gdim)]/50 hover:text-[var(--tx)] border-l-transparent"
                    }`}
                  >
                    <span className={pathname === "/crew/expense" ? "text-[var(--gold)]" : "text-[var(--tx3)]"}>
                      <Icons.dollarSign />
                    </span>
                    <span>Expenses</span>
                  </Link>
                  <Link
                    href="/crew/end-of-day"
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 text-[12px] font-medium transition-all duration-150 border-l-2 -ml-px ${
                      isActive("/crew/end-of-day")
                        ? "bg-[var(--gdim)] text-[var(--gold)] border-l-[var(--gold)] font-semibold"
                        : "text-[var(--tx2)] hover:bg-[var(--gdim)]/50 hover:text-[var(--tx)] border-l-transparent"
                    }`}
                  >
                    <span className={pathname === "/crew/end-of-day" ? "text-[var(--gold)]" : "text-[var(--tx3)]"}>
                      <Icons.fileText />
                    </span>
                    <span>End of Day</span>
                  </Link>
                </div>
              </div>
            </nav>

            <div className="shrink-0 px-4 py-3 border-t border-[var(--brd)]">
              {crewMember?.name && (
                <div className="text-[11px] font-semibold text-[var(--tx)] truncate mb-2">{crewMember.name}</div>
              )}
              <form action="/api/crew/logout" method="POST" className="w-full">
                <button
                  type="submit"
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium text-[var(--tx2)] hover:bg-[var(--gdim)] hover:text-[var(--gold)] border border-[var(--brd)] transition-colors"
                >
                  Sign out
                </button>
              </form>
            </div>
          </aside>

          <div className="hidden md:block shrink-0 w-[220px]" />

          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <div
              className="fixed top-0 right-0 h-14 flex items-center justify-between gap-2 sm:gap-4 z-30 shrink-0 bg-[var(--bg)]/80 backdrop-blur-md border-b border-[var(--brd)]/60 shadow-[0_1px_0_0_rgba(0,0,0,0.05)] safe-area-top left-0 pl-3 pr-3 sm:px-4 md:left-[220px] md:px-6"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden size-10 flex items-center justify-center rounded-lg hover:bg-[var(--card)] active:bg-[var(--gdim)] transition-colors touch-manipulation text-[var(--tx2)] shrink-0 -ml-0.5"
                  aria-label="Open menu"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </button>
                {!hideHeaderTitle && (
                  <div className="min-w-0 flex-1 py-0.5">
                    <h2 className="font-hero text-[15px] font-semibold text-[var(--tx)] truncate leading-tight">{title}</h2>
                    {subtitle && (
                      <div className="text-[11px] text-[var(--tx3)] truncate mt-0.5 leading-tight">{subtitle}</div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex-shrink-0">
                <form action="/api/crew/logout" method="POST">
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-[var(--tx2)] hover:bg-[var(--gdim)] hover:text-[var(--gold)] transition-colors"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>

            <main id="crew-main" key={pathname} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 admin-main-offset animate-fade-in">
              {children}
            </main>
          </div>
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}
