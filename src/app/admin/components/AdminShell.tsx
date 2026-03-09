"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToastProvider } from "./Toast";
import { NotificationProvider } from "./NotificationContext";
import { PendingChangeRequestsProvider, usePendingChangeRequests } from "./PendingChangeRequestsContext";
import { ThemeProvider } from "./ThemeContext";
import NotificationDropdown from "./NotificationDropdown";
import ProfileDropdown from "./ProfileDropdown";
import SearchBox from "./SearchBox";
import RealtimeListener from "./RealtimeListener";
import SessionTimeout from "./SessionTimeout";
import { Icons } from "./SidebarIcons";
import YugoLogo, { BetaBadge } from "@/components/YugoLogo";
import { createClient } from "@/lib/supabase/client";
import { Shield } from "lucide-react";

const ROLE_LEVEL: Record<string, number> = {
  owner: 100, admin: 80, manager: 60, dispatcher: 50, coordinator: 40, viewer: 30, crew: 20, partner: 10,
};

interface SidebarItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  minRole?: string;
  badgeKey?: "quotes";
}

const SIDEBAR_SECTIONS_FULL: { label: string; items: SidebarItem[] }[] = [
  {
    label: "Dashboard",
    items: [
      { href: "/admin", label: "Command Center", Icon: Icons.home, minRole: "coordinator" },
      { href: "/admin/calendar", label: "Calendar", Icon: Icons.calendar },
      { href: "/admin/crew", label: "Tracking", Icon: Icons.mapPin },
      { href: "/admin/crew/analytics", label: "Crew Analytics", Icon: Icons.barChart, minRole: "admin" },
    ],
  },
  {
    label: "B2B Partners",
    items: [
      { href: "/admin/partners", label: "All Partners", Icon: Icons.users, minRole: "coordinator" },
      { href: "/admin/deliveries", label: "All Deliveries", Icon: Icons.truck, minRole: "coordinator" },
      { href: "/admin/projects", label: "Projects", Icon: Icons.clipboardList, minRole: "admin" },
      { href: "/admin/partners/retail", label: "Retail", Icon: Icons.sofa, minRole: "admin" },
      { href: "/admin/partners/designers", label: "Designers", Icon: Icons.palette, minRole: "admin" },
      { href: "/admin/partners/hospitality", label: "Hospitality", Icon: Icons.hotel, minRole: "admin" },
      { href: "/admin/partners/gallery", label: "Art Gallery", Icon: Icons.image, minRole: "admin" },
      { href: "/admin/partners/realtors", label: "Realtors", Icon: Icons.handshake, minRole: "admin" },
    ],
  },
  {
    label: "Moves",
    items: [
      { href: "/admin/quotes", label: "Quotes", Icon: Icons.quoteClipboard, badgeKey: "quotes" },
      { href: "/admin/widget-leads", label: "Widget Leads", Icon: Icons.zap, minRole: "coordinator" },
      { href: "/admin/moves", label: "All Moves", Icon: Icons.truck },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/admin/invoices", label: "Invoices", Icon: Icons.fileText, minRole: "admin" },
      { href: "/admin/revenue", label: "Revenue", Icon: Icons.dollarSign, minRole: "admin" },
      { href: "/admin/tips", label: "Tips", Icon: Icons.creditCard, minRole: "admin" },
      { href: "/admin/claims", label: "Claims", Icon: Icons.shield, minRole: "admin" },
      { href: "/admin/finance/profitability", label: "Profitability", Icon: Icons.trendingUp, minRole: "owner" },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/admin/clients", label: "Contacts", Icon: Icons.users, minRole: "admin" },
      { href: "/admin/change-requests", label: "Change Requests", Icon: Icons.clipboardList, minRole: "admin" },
      { href: "/admin/messages", label: "Messages", Icon: Icons.messageSquare, minRole: "admin" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/admin/platform", label: "Platform", Icon: Icons.settings, minRole: "admin" },
      { href: "/admin/platform?tab=rate-templates", label: "Rate Templates", Icon: Icons.dollarSign, minRole: "owner" },
    ],
  },
];

function SidebarNavItem({
  href,
  active,
  ItemIcon,
  label,
  showChangeRequestDot,
  badgeCount,
  onNavigate,
}: {
  href: string;
  active: boolean;
  ItemIcon: React.ComponentType<{ className?: string }>;
  label: string;
  showChangeRequestDot: boolean;
  badgeCount?: number;
  onNavigate: () => void;
}) {
  const { pendingCount } = usePendingChangeRequests();
  const crBadge = showChangeRequestDot && pendingCount > 0;
  const count = crBadge ? pendingCount : badgeCount && badgeCount > 0 ? badgeCount : 0;
  const showBadge = count > 0;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`sidebar-nav-lift flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-[12px] font-medium border-l-2 -ml-px ${
        active
          ? "bg-[var(--gdim)] text-[var(--gold)] border-l-[var(--gold)] font-semibold"
          : "text-[var(--tx2)] hover:bg-[var(--gdim)]/60 hover:text-[var(--tx)] border-l-transparent"
      }`}
    >
      <span className={`relative shrink-0 ${active ? "text-[var(--gold)]" : "text-[var(--tx3)]"}`}>
        <ItemIcon />
        {showBadge && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--gold)] ring-2 ring-[var(--bg2)]" aria-hidden />
        )}
      </span>
      <span className={`min-w-0 flex-1 flex items-center justify-between gap-2 ${active ? "font-bold" : ""}`}>
        <span className="truncate">{label}</span>
        {showBadge && (
          <span className="shrink-0 min-w-[18px] h-[18px] px-1.5 rounded-full bg-[var(--gold)]/20 text-[var(--gold)] text-[10px] font-bold flex items-center justify-center">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
    </Link>
  );
}

export default function AdminShell({ user, isSuperAdmin = false, isAdmin = true, role = "dispatcher", twoFactorEnabled = false, children }: { user: any; isSuperAdmin?: boolean; isAdmin?: boolean; role?: string; twoFactorEnabled?: boolean; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [quoteBadge, setQuoteBadge] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .in("status", ["sent", "viewed"])
      .then(({ count }) => { if (typeof count === "number") setQuoteBadge(count); });
  }, [pathname]);

  const userLevel = ROLE_LEVEL[role] ?? 0;

  const sidebarSections = SIDEBAR_SECTIONS_FULL.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      const needed = ROLE_LEVEL[item.minRole ?? "viewer"] ?? 0;
      return userLevel >= needed || isSuperAdmin;
    }),
  })).filter((s) => s.items.length > 0);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    // For /admin/crew, only "Tracking" is active on exact /admin/crew; Crew Analytics on /admin/crew/analytics
    if (href === "/admin/crew") return pathname === "/admin/crew";
    return pathname.startsWith(href);
  };

  return (
    <ThemeProvider>
      <NotificationProvider>
        <PendingChangeRequestsProvider>
          <ToastProvider>
            <RealtimeListener />
            <SessionTimeout />
          <div className="flex min-h-screen bg-[var(--bg)]">
            {/* Skip to main content for keyboard users */}
            <a
              href="#admin-main"
              className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[var(--gold)] focus:text-white focus:font-semibold focus:outline-none"
            >
              Skip to main content
            </a>
            {/* Mobile overlay - subtle dim, no heavy blur */}
            {sidebarOpen && (
              <div
                className="fixed inset-0 z-40 md:hidden bg-black/35"
                style={{ left: "220px" }}
                onClick={() => setSidebarOpen(false)}
                aria-hidden="true"
              />
            )}

            {/* Sidebar - no overflow, seamless on mobile */}
            <aside
              className={`
                fixed top-0 left-0 z-50 h-dvh h-screen max-h-[100dvh] flex flex-col overflow-hidden
                glass-sidebar border-r border-[var(--brd)]/50
                transition-all duration-300 ease-out
                ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
                ${sidebarCollapsed ? "md:w-0 md:overflow-hidden md:border-0" : "w-[220px]"}
              `}
              style={sidebarCollapsed ? { minWidth: 0 } : undefined}
            >
              {/* Logo bar - completely transparent, floating text only */}
              <div className="h-14 px-4 flex items-center shrink-0 bg-transparent">
                <div className={`flex items-center justify-between w-full transition-opacity duration-200 ${sidebarCollapsed ? "md:opacity-0 md:w-0 md:overflow-hidden" : ""}`}>
                  <div className="flex items-center gap-2">
                    <YugoLogo size={18} />
                    <BetaBadge />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                      className="hidden md:flex p-2 rounded-lg hover:bg-[var(--card)]/50 transition-colors text-[var(--tx2)]"
                      aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={sidebarCollapsed ? "rotate-180" : ""}>
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="md:hidden p-2 rounded-lg hover:bg-[var(--card)]/50 transition-colors text-[var(--tx2)]"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Nav sections - scrollable inside sidebar, no overflow past viewport */}
              <nav className={`icon-glow flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] overscroll-contain scrollbar-hide ${sidebarCollapsed ? "md:hidden" : ""}`} style={{ WebkitOverflowScrolling: "touch" }}>
                {sidebarSections.map((section) => {
                  const isCollapsed = collapsedSections[section.label] ?? false;
                  const hasActive = section.items.some((item) => isActive(item.href));
                  return (
                    <div key={section.label} className="mb-4 last:mb-0">
                      <button
                        type="button"
                        onClick={() => setCollapsedSections((prev) => ({ ...prev, [section.label]: !prev[section.label] }))}
                        className="sidebar-nav-lift w-full flex items-center justify-between text-[9px] font-semibold tracking-[1.2px] uppercase text-[var(--tx3)] px-4 py-2 mx-2 rounded-lg font-heading hover:text-[var(--tx2)]"
                      >
                        {section.label}
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${isCollapsed ? "-rotate-90" : ""}`}>
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                      {!isCollapsed && (
                        <div className="space-y-0.5">
                          {section.items.map((item) => {
                            const active = isActive(item.href);
                            const ItemIcon = item.Icon;
                            const showChangeRequestDot = item.href === "/admin/change-requests";
                            const itemBadge = "badgeKey" in item && (item as { badgeKey?: string }).badgeKey === "quotes" ? quoteBadge : undefined;
                            return (
                              <SidebarNavItem
                                key={item.href}
                                href={item.href}
                                active={active}
                                ItemIcon={ItemIcon}
                                label={item.label}
                                showChangeRequestDot={showChangeRequestDot}
                                badgeCount={itemBadge}
                                onNavigate={() => setSidebarOpen(false)}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </aside>

            {/* Spacer for fixed sidebar on desktop */}
            <div className={`hidden md:block shrink-0 transition-all duration-300 ${sidebarCollapsed ? "w-0" : "w-[220px]"}`} />

            {/* Main - .main */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 admin-main-offset">
              {/* Topbar - floating, static; safe area on notched devices */}
              <div
                className={`fixed top-0 right-0 h-14 flex items-center justify-between gap-2 sm:gap-4 z-30 shrink-0 glass-topbar border-b border-[var(--brd)]/50 transition-all duration-300 safe-area-top ${sidebarCollapsed ? "left-0 pl-2 pr-3 sm:pl-3 sm:pr-4 md:pl-3 md:pr-6" : "left-0 pl-3 pr-3 sm:px-4 md:left-[220px] md:px-6"}`}
              >
                <button
                  onClick={() => (sidebarCollapsed ? setSidebarCollapsed(false) : setSidebarOpen(true))}
                  className={`size-10 flex items-center justify-center rounded-lg hover:bg-[var(--card)] active:bg-[var(--gdim)] transition-colors touch-manipulation text-[var(--tx2)] shrink-0 -ml-0.5 ${sidebarCollapsed ? "md:flex" : "md:hidden"}`}
                  aria-label={sidebarCollapsed ? "Open sidebar" : "Open menu"}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </button>

                <SearchBox />

                <div className="flex items-center gap-1.5 shrink-0">
                  <NotificationDropdown />
                  <ProfileDropdown user={user} />
                </div>
              </div>

              {role === "owner" && !twoFactorEnabled && (
                <div className="sticky top-14 z-20 px-4 py-2.5 text-center text-[12px] font-medium bg-amber-500/10 border-b border-amber-500/20 text-amber-400">
                  <Shield className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
                  Two-factor authentication is required for owner accounts.{" "}
                  <Link href="/admin/platform?tab=users" className="underline font-bold hover:text-amber-300">
                    Enable 2FA
                  </Link>
                </div>
              )}

              {/* Content - key forces fade-in on route change; overflow-x-hidden on mobile to prevent horizontal scroll */}
              <main id="admin-main" key={pathname} className="flex-1 overflow-y-auto overflow-x-hidden md:overflow-x-auto tab-content min-h-0">
                {children}
              </main>
            </div>
          </div>
          </ToastProvider>
        </PendingChangeRequestsProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}
