"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import CommandPalette from "./CommandPalette";
import { createClient } from "@/lib/supabase/client";
import {
  CaretDown,
  CaretLeft,
  CaretRight,
  FilePlus,
  List,
  MapPin,
  Plus,
  Receipt,
  Shield,
  SquaresFour,
  Truck,
  UserPlus,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import OfflineBanner from "@/components/ui/OfflineBanner";

const ROLE_LEVEL: Record<string, number> = {
  owner: 100, admin: 80, manager: 60, dispatcher: 50, coordinator: 40, viewer: 30, sales: 25, crew: 20, partner: 10,
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
      { href: "/admin/activity", label: "Activity", Icon: Icons.activity, minRole: "coordinator" },
      { href: "/admin/dispatch", label: "Dispatch", Icon: Icons.dispatch, minRole: "dispatcher" },
      { href: "/admin/calendar", label: "Calendar", Icon: Icons.calendar, minRole: "sales" },
      { href: "/admin/drafts", label: "Drafts", Icon: Icons.drafts },
      { href: "/admin/crew", label: "Live Tracking", Icon: Icons.mapPin },
      { href: "/admin/crew/analytics", label: "Crew Analytics", Icon: Icons.barChart, minRole: "admin" },
      { href: "/admin/reports", label: "Reports", Icon: Icons.clipboardList, minRole: "admin" },
    ],
  },
  {
    label: "Partners",
    items: [
      { href: "/admin/partners", label: "All Partners", Icon: Icons.handshake, minRole: "coordinator" },
      { href: "/admin/partners/health", label: "Partner Health", Icon: Icons.barChart, minRole: "coordinator" },
      { href: "/admin/partners/realtors", label: "Referral Partners", Icon: Icons.handshake, minRole: "coordinator" },
      { href: "/admin/deliveries", label: "Jobs", Icon: Icons.briefcase, minRole: "coordinator" },
    ],
  },
  {
    label: "Moves",
    items: [
      { href: "/admin/quotes", label: "Quotes", Icon: Icons.quoteClipboard, badgeKey: "quotes", minRole: "sales" },
      { href: "/admin/widget-leads", label: "Widget Leads", Icon: Icons.zap, minRole: "sales" },
      { href: "/admin/moves", label: "All Moves", Icon: Icons.path },
    ],
  },
  {
    label: "Services",
    items: [
      { href: "/admin/bin-rentals", label: "Bin Rentals", Icon: Icons.package, minRole: "coordinator" },
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
      { href: "/admin/clients", label: "Contacts", Icon: Icons.userCheck, minRole: "admin" },
      { href: "/admin/change-requests", label: "Change Requests", Icon: Icons.clipboardList, minRole: "admin" },
      { href: "/admin/perks", label: "Perks & Referrals", Icon: Icons.gift, minRole: "admin" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/admin/platform", label: "Platform", Icon: Icons.settings, minRole: "owner" },
      { href: "/admin/users", label: "Users", Icon: Icons.usersThree, minRole: "owner" },
      { href: "/admin/settings", label: "Account", Icon: Icons.lock, minRole: "coordinator" },
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
  rail = false,
}: {
  href: string;
  active: boolean;
  ItemIcon: React.ComponentType<{ className?: string }>;
  label: string;
  showChangeRequestDot: boolean;
  badgeCount?: number;
  onNavigate: () => void;
  rail?: boolean;
}) {
  const { pendingCount } = usePendingChangeRequests();
  const crBadge = showChangeRequestDot && pendingCount > 0;
  const count = crBadge ? pendingCount : badgeCount && badgeCount > 0 ? badgeCount : 0;
  const showBadge = count > 0;

  if (rail) {
    return (
      <Link
        href={href}
        onClick={onNavigate}
        title={label}
        className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors mx-auto ${
          active
            ? "bg-[var(--gdim)] text-[var(--gold)]"
            : "text-[var(--tx3)] hover:bg-[var(--gdim)]/60 hover:text-[var(--tx2)]"
        }`}
      >
        <ItemIcon />
        {showBadge && (
          <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[var(--gold)] ring-2 ring-[var(--bg2)]" aria-hidden />
        )}
      </Link>
    );
  }

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

const QUICK_ACTIONS = [
  {
    label: "New Move",
    href: "/admin/moves/new",
    icon: <Truck size={18} weight="regular" className="text-current" aria-hidden />,
    color: "var(--gold)",
  },
  {
    label: "New Quote",
    href: "/admin/quotes/new",
    icon: <FilePlus size={18} weight="regular" className="text-current" aria-hidden />,
    color: "var(--grn)",
  },
  {
    label: "New Contact",
    href: "/admin/clients/new",
    icon: <UserPlus size={18} weight="regular" className="text-current" aria-hidden />,
    color: "#7C9FD4",
  },
  {
    label: "New Partner",
    href: "/admin/partners/new",
    icon: <UsersThree size={18} weight="regular" className="text-current" aria-hidden />,
    color: "#B07FD4",
  },
  {
    label: "New Delivery",
    href: "/admin/deliveries/new",
    icon: <MapPin size={18} weight="regular" className="text-current" aria-hidden />,
    color: "#D4A07F",
  },
  {
    label: "New Invoice",
    href: "/admin/invoices/new",
    icon: <Receipt size={18} weight="regular" className="text-current" aria-hidden />,
    color: "#7FD4C1",
  },
];

export default function AdminShell({ user, isSuperAdmin = false, isAdmin = true, role = "dispatcher", twoFactorEnabled = false, children }: { user: any; isSuperAdmin?: boolean; isAdmin?: boolean; role?: string; twoFactorEnabled?: boolean; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("yugo_sidebar_collapsed") === "1"; } catch { return false; }
  });
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem("yugo_sidebar_sections");
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [quoteBadge, setQuoteBadge] = useState(0);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const quickActionsRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .in("status", ["sent", "viewed"])
      .then(({ count }) => { if (typeof count === "number") setQuoteBadge(count); });
  }, [pathname]);

  useEffect(() => {
    if (!quickActionsOpen) return;
    const handler = (e: MouseEvent) => {
      if (quickActionsRef.current && !quickActionsRef.current.contains(e.target as Node)) {
        setQuickActionsOpen(false);
      }
    };
    const escHandler = (e: KeyboardEvent) => { if (e.key === "Escape") setQuickActionsOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", escHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", escHandler);
    };
  }, [quickActionsOpen]);

  // Persist sidebar collapsed state
  useEffect(() => {
    try { localStorage.setItem("yugo_sidebar_collapsed", sidebarCollapsed ? "1" : "0"); } catch {}
  }, [sidebarCollapsed]);

  // Persist collapsed sections
  useEffect(() => {
    try { localStorage.setItem("yugo_sidebar_sections", JSON.stringify(collapsedSections)); } catch {}
  }, [collapsedSections]);

  // ⌘K / Ctrl+K opens command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const userLevel = ROLE_LEVEL[role] ?? 0;

  const MOBILE_NAV = [
    { href: "/admin", label: "Home", Icon: Icons.home, exact: true as const },
  ].filter((item) => {
    const needed = ROLE_LEVEL[(item as { minRole?: string }).minRole ?? "viewer"] ?? 0;
    return userLevel >= needed || isSuperAdmin;
  });

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
            <OfflineBanner />
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
                ${sidebarCollapsed ? "md:w-14 w-[220px]" : "w-[220px]"}
              `}
            >
              {/* Logo bar */}
              <div className="h-14 flex items-center shrink-0 bg-transparent border-b border-[var(--brd)]/20">
                {/* Rail mode: show only expand button */}
                <div className={`hidden md:flex w-full items-center justify-center transition-all duration-200 ${sidebarCollapsed ? "" : "opacity-0 pointer-events-none absolute"}`}>
                  <button
                    onClick={() => setSidebarCollapsed(false)}
                    className="p-2.5 rounded-lg hover:bg-[var(--card)]/50 transition-colors text-[var(--tx3)] hover:text-[var(--tx2)]"
                    title="Expand sidebar"
                    aria-label="Expand sidebar"
                  >
                    <CaretRight size={15} weight="regular" className="text-current" aria-hidden />
                  </button>
                </div>
                {/* Full mode: logo + collapse button */}
                <div className={`flex items-center justify-between w-full px-4 transition-all duration-200 ${sidebarCollapsed ? "md:opacity-0 md:pointer-events-none" : ""}`}>
                  <div className="flex items-center gap-2">
                    <YugoLogo size={18} />
                    <BetaBadge />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSidebarCollapsed(true)}
                      className="hidden md:flex p-2 rounded-lg hover:bg-[var(--card)]/50 transition-colors text-[var(--tx3)] hover:text-[var(--tx2)]"
                      aria-label="Collapse sidebar"
                      title="Collapse sidebar"
                    >
                      <CaretLeft size={15} weight="regular" className="text-current" aria-hidden />
                    </button>
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="md:hidden p-2 rounded-lg hover:bg-[var(--card)]/50 transition-colors text-[var(--tx2)]"
                    >
                      <X size={15} weight="regular" className="text-current" aria-hidden />
                    </button>
                  </div>
                </div>
              </div>

              {/* Full nav, visible in expanded mode (and always on mobile) */}
              <nav className={`icon-glow flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-3 pb-[max(4rem,env(safe-area-inset-bottom))] overscroll-contain scrollbar-hide ${sidebarCollapsed ? "md:hidden" : ""}`} style={{ WebkitOverflowScrolling: "touch" }}>
                {sidebarSections.map((section) => {
                  const isCollapsed = collapsedSections[section.label] ?? false;
                  return (
                    <div key={section.label} className="mb-4 last:mb-0">
                      <button
                        type="button"
                        onClick={() => setCollapsedSections((prev) => ({ ...prev, [section.label]: !prev[section.label] }))}
                        className="sidebar-nav-lift w-full flex items-center justify-between text-[9px] font-semibold tracking-[1.2px] uppercase text-[var(--tx3)] px-4 py-2 mx-2 rounded-lg font-heading hover:text-[var(--tx2)]"
                      >
                        {section.label}
                        <CaretDown
                          size={10}
                          weight="regular"
                          className={`text-current transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                          aria-hidden
                        />
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

              {/* Rail nav, icon-only, desktop collapsed mode */}
              <nav className={`hidden ${sidebarCollapsed ? "md:flex" : ""} flex-col flex-1 min-h-0 overflow-y-auto py-3 pb-4 gap-0.5 items-center overscroll-contain scrollbar-hide`}>
                {sidebarSections.map((section, si) => (
                  <div key={section.label} className={`w-full flex flex-col items-center gap-0.5 ${si > 0 ? "mt-2 pt-2 border-t border-[var(--brd)]/30" : ""}`}>
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
                          rail
                        />
                      );
                    })}
                  </div>
                ))}
              </nav>
            </aside>

            {/* Spacer for fixed sidebar on desktop */}
            <div className={`hidden md:block shrink-0 transition-all duration-300 ${sidebarCollapsed ? "w-14" : "w-[220px]"}`} />

            {/* Main - .main */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 admin-main-offset">
              {/* Topbar - floating, static; safe area on notched devices */}
              <div
                className={`fixed top-0 right-0 h-14 flex items-center justify-between gap-2 sm:gap-4 z-30 shrink-0 glass-topbar border-b border-[var(--brd)]/50 transition-all duration-300 safe-area-top ${sidebarCollapsed ? "left-0 pl-3 pr-3 sm:px-4 md:left-14 md:px-6" : "left-0 pl-3 pr-3 sm:px-4 md:left-[220px] md:px-6"}`}
              >
                <button
                  onClick={() => setSidebarOpen(true)}
                  className={`size-10 items-center justify-center rounded-lg hover:bg-[var(--card)] active:bg-[var(--gdim)] transition-colors touch-manipulation text-[var(--tx2)] shrink-0 -ml-0.5 ${sidebarCollapsed ? "flex md:hidden" : "hidden"}`}
                  aria-label="Open menu"
                >
                  <List size={20} weight="regular" className="text-current" aria-hidden />
                </button>

                <SearchBox />

                <div className="flex items-center gap-1.5 shrink-0">
                  <NotificationDropdown />
                  <ProfileDropdown user={user} />
                </div>
              </div>

              {role === "owner" && !twoFactorEnabled && (
                <div className="sticky top-14 z-20 px-4 py-2.5 text-center text-[12px] font-medium bg-amber-500/10 border-b border-amber-500/20 text-amber-400">
                  <Shield weight="regular" className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
                  Two-factor authentication is required for owner accounts.{" "}
                  <Link href="/admin/settings/security" className="underline font-bold hover:text-amber-300">
                    Enable 2FA
                  </Link>
                </div>
              )}

              {/* Content - key forces fade-in on route change; overflow-x-hidden on mobile to prevent horizontal scroll */}
              <main id="admin-main" key={pathname} className="flex-1 overflow-y-auto overflow-x-hidden md:overflow-x-auto tab-content min-h-0 pb-mobile-nav md:pb-0">
                {children}
              </main>
            </div>

            {/* ── Mobile bottom navigation bar ── */}
            <div className="md:hidden" ref={quickActionsRef}>
              {/* Quick Actions Sheet */}
              {quickActionsOpen && (
                <div className="fixed inset-0 z-[70]" aria-hidden="true">
                  <div
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
                    onClick={() => setQuickActionsOpen(false)}
                  />
                  <div
                    className="absolute bottom-[calc(64px+env(safe-area-inset-bottom,0px))] left-0 right-0 mx-3 mb-2 glass-topbar border border-[var(--brd)]/60 rounded-2xl overflow-hidden shadow-2xl"
                    style={{ animation: "slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1) both" }}
                  >
                    <div className="px-4 pt-4 pb-1">
                      <p className="text-[10px] font-bold tracking-[1.4px] uppercase text-[var(--tx3)]">Quick Create</p>
                    </div>
                    <div className="grid grid-cols-3 gap-px p-2">
                      {QUICK_ACTIONS.map((action) => (
                        <button
                          key={action.label}
                          onClick={() => {
                            setQuickActionsOpen(false);
                            router.push(action.href);
                          }}
                          className="flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl hover:bg-[var(--card)] active:scale-95 transition-all touch-manipulation"
                        >
                          <span
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: `${action.color}18`, color: action.color }}
                          >
                            {action.icon}
                          </span>
                          <span className="text-[10px] font-semibold text-[var(--tx2)] leading-tight text-center">
                            {action.label}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="h-2" />
                  </div>
                </div>
              )}

              <nav
                className="fixed bottom-0 left-0 right-0 z-[60] glass-topbar border-t border-[var(--brd)]/50"
                style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
              >
                <div className="flex items-end h-16">
                  {/* Left two nav items */}
                  {MOBILE_NAV.slice(0, 2).map((item) => {
                    const active = (item as { exact?: boolean }).exact ? pathname === item.href : pathname.startsWith(item.href);
                    const ItemIcon = item.Icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex-1 flex flex-col items-center justify-center gap-[3px] h-full pb-1 touch-manipulation transition-colors ${
                          active ? "text-[var(--gold)]" : "text-[var(--tx3)]"
                        }`}
                      >
                        <span className={active ? "text-[var(--gold)]" : "text-[var(--tx3)]"}>
                          <ItemIcon />
                        </span>
                        <span className="text-[9px] font-bold tracking-wide uppercase leading-none">{item.label}</span>
                      </Link>
                    );
                  })}

                  {/* Centre gold + button */}
                  <div className="flex-1 flex flex-col items-center justify-end pb-1 relative">
                    <button
                      onClick={() => setQuickActionsOpen((v) => !v)}
                      aria-label="Quick create"
                      aria-expanded={quickActionsOpen}
                      className={`-mt-5 w-[52px] h-[52px] rounded-full flex items-center justify-center shadow-md active:scale-95 transition-all touch-manipulation ${
                        quickActionsOpen
                          ? "bg-[var(--gold2)] rotate-45"
                          : "bg-[var(--gold)]"
                      }`}
                      style={{ boxShadow: "0 2px 10px rgba(201,169,98,0.22), 0 1px 2px rgba(0,0,0,0.06)" }}
                    >
                      <Plus size={22} weight="regular" color="#fff" aria-hidden />
                    </button>
                    <span className="mt-1 text-[9px] font-bold tracking-wide uppercase leading-none text-[var(--tx3)]">Create</span>
                  </div>

                  {/* Right two nav items */}
                  {MOBILE_NAV.slice(2).map((item) => {
                    const active = (item as { exact?: boolean }).exact ? pathname === item.href : pathname.startsWith(item.href);
                    const ItemIcon = item.Icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex-1 flex flex-col items-center justify-center gap-[3px] h-full pb-1 touch-manipulation transition-colors ${
                          active ? "text-[var(--gold)]" : "text-[var(--tx3)]"
                        }`}
                      >
                        <span className={active ? "text-[var(--gold)]" : "text-[var(--tx3)]"}>
                          <ItemIcon />
                        </span>
                        <span className="text-[9px] font-bold tracking-wide uppercase leading-none">{item.label}</span>
                      </Link>
                    );
                  })}

                  {/* More, opens full sidebar drawer */}
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="flex-1 flex flex-col items-center justify-center gap-[3px] h-full pb-1 touch-manipulation text-[var(--tx3)]"
                  >
                    <SquaresFour size={16} weight="regular" className="text-current" aria-hidden />
                    <span className="text-[9px] font-bold tracking-wide uppercase leading-none">More</span>
                  </button>
                </div>
              </nav>
            </div>

          </div>
          <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
          </ToastProvider>
        </PendingChangeRequestsProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}
