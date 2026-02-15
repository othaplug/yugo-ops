"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToastProvider } from "./Toast";
import { NotificationProvider } from "./NotificationContext";
import { ThemeProvider } from "./ThemeContext";
import NotificationDropdown from "./NotificationDropdown";
import ProfileDropdown from "./ProfileDropdown";
import SearchBox from "./SearchBox";
import ClientDate from "./ClientDate";
import { Icons } from "./SidebarIcons";

const SIDEBAR_SECTIONS = [
  {
    label: "Dashboard",
    items: [
      { href: "/admin", label: "Command Center", Icon: Icons.target },
      { href: "/admin/deliveries", label: "All Deliveries", Icon: Icons.package },
      { href: "/admin/calendar", label: "Calendar", Icon: Icons.calendar },
      { href: "/admin/crew", label: "Crew Tracking", Icon: Icons.mapPin },
    ],
  },
  {
    label: "B2B Partners",
    items: [
      { href: "/admin/partners/retail", label: "Retail", Icon: Icons.sofa },
      { href: "/admin/partners/designers", label: "Designers", Icon: Icons.palette },
      { href: "/admin/partners/hospitality", label: "Hospitality", Icon: Icons.hotel },
      { href: "/admin/partners/gallery", label: "Art Gallery", Icon: Icons.image },
      { href: "/admin/partners/realtors", label: "Realtors", Icon: Icons.handshake },
    ],
  },
  {
    label: "Moves",
    items: [
      { href: "/admin/moves/residential", label: "Residential", Icon: Icons.home },
      { href: "/admin/moves/office", label: "Office / Commercial", Icon: Icons.building },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/admin/invoices", label: "Invoices", Icon: Icons.fileText },
      { href: "/admin/revenue", label: "Revenue", Icon: Icons.dollarSign },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/clients", label: "All Clients", Icon: Icons.users },
      { href: "/admin/messages", label: "Messages", Icon: Icons.messageSquare },
    ],
  },
];

const PAGE_TITLES: Record<string, { title: string; subtitle: string; useClientDate?: boolean }> = {
  "/admin": { title: "Command Center", subtitle: "", useClientDate: true },
  "/admin/deliveries": { title: "All Deliveries", subtitle: "Scheduling & tracking" },
  "/admin/calendar": { title: "Crew Calendar", subtitle: "Feb 10-14, 2026" },
  "/admin/crew": { title: "Crew Tracking", subtitle: "Live GPS positions" },
  "/admin/partners/retail": { title: "Retail Partners", subtitle: "White-glove delivery" },
  "/admin/partners/designers": { title: "Designer Dashboard", subtitle: "Projects & vendors" },
  "/admin/partners/hospitality": { title: "Hospitality", subtitle: "FF&E & seasonal" },
  "/admin/partners/gallery": { title: "Art Gallery", subtitle: "Transport & exhibitions" },
  "/admin/partners/realtors": { title: "Realtor Partners", subtitle: "Referrals" },
  "/admin/moves/residential": { title: "Residential Moves", subtitle: "Client tracking" },
  "/admin/moves/office": { title: "Office Moves", subtitle: "Commercial logistics" },
  "/admin/invoices": { title: "Invoices", subtitle: "Billing" },
  "/admin/revenue": { title: "Revenue", subtitle: "Financial overview" },
  "/admin/clients": { title: "All Clients", subtitle: "Account management" },
  "/admin/messages": { title: "Messages", subtitle: "Communications" },
  "/admin/settings": { title: "Profile Settings", subtitle: "Account, security & preferences" },
  "/admin/platform": { title: "Platform Settings", subtitle: "Pricing, crews & partners" },
};

function getPageTitle(pathname: string): { title: string; subtitle: string; useClientDate?: boolean } {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/admin/deliveries/")) return { title: "Delivery Detail", subtitle: "", useClientDate: false };
  if (pathname.startsWith("/admin/partners/designers/") && pathname !== "/admin/partners/designers") return { title: "Project Detail", subtitle: "", useClientDate: false };
  if (pathname.startsWith("/admin/clients/")) return { title: "Client Detail", subtitle: "", useClientDate: false };
  if (pathname.startsWith("/admin/deliveries/new")) return { title: "New Delivery", subtitle: "", useClientDate: false };
  if (pathname.match(/^\/admin\/moves\/[a-f0-9-]+$/i)) return { title: "Move Detail", subtitle: "", useClientDate: false };
  return { title: "OPS+", subtitle: "", useClientDate: false };
}

const SIDEBAR_WIDTH = 220;

export default function AdminShell({ user, children }: { user: any; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const { title, subtitle, useClientDate } = getPageTitle(pathname);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  return (
    <ThemeProvider>
      <NotificationProvider>
        <ToastProvider>
          <div className="flex min-h-screen bg-[var(--bg)]">
            {/* Mobile overlay */}
            {sidebarOpen && (
              <div
                className="fixed inset-0 bg-black/70 z-40 md:hidden backdrop-blur-sm"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* Sidebar - glass, collapsible */}
            <aside
              className={`
                fixed top-0 left-0 z-50 h-screen flex flex-col
                bg-[var(--bg2)]/70 backdrop-blur-xl border-r border-[var(--brd)]/50
                transition-all duration-300 ease-out sidebar-scroll
                ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
                ${sidebarCollapsed ? "md:w-0 md:overflow-hidden md:border-0" : "w-[220px]"}
              `}
              style={sidebarCollapsed ? { minWidth: 0 } : undefined}
            >
              {/* Logo bar - completely transparent, floating text only */}
              <div className="h-14 px-4 flex items-center shrink-0 bg-transparent">
                <div className={`flex items-center justify-between w-full transition-opacity duration-200 ${sidebarCollapsed ? "md:opacity-0 md:w-0 md:overflow-hidden" : ""}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="font-heading text-[17px] tracking-[2px] text-[var(--tx)] font-semibold drop-shadow-sm">YUGO</span>
                    <span className="text-[8px] font-bold tracking-[1.2px] text-[var(--gold)] px-[7px] py-[3px] rounded-md drop-shadow-sm">
                      OPS+
                    </span>
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

              {/* Nav sections - scrollable */}
              <nav className={`flex-1 py-3 overflow-y-auto overflow-x-hidden min-h-0 ${sidebarCollapsed ? "md:hidden" : ""}`}>
                {SIDEBAR_SECTIONS.map((section) => (
                  <div key={section.label} className="mb-4 last:mb-0">
                    <div className="text-[9px] font-semibold tracking-[1.2px] uppercase text-[var(--tx3)] px-4 py-2 font-heading">
                      {section.label}
                    </div>
                    <div className="space-y-0.5">
                      {section.items.map((item) => {
                        const active = isActive(item.href);
                        const ItemIcon = item.Icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex items-center gap-3 px-4 py-2.5 text-[12px] font-medium transition-all duration-150 ease-out border-l-2 -ml-px ${
                              active
                                ? "bg-[var(--gdim)] text-[var(--gold)] border-l-[var(--gold)]"
                                : "text-[var(--tx2)] hover:bg-[var(--gdim)]/50 hover:text-[var(--tx)] border-l-transparent"
                            }`}
                          >
                            <span className={active ? "text-[var(--gold)]" : "text-[var(--tx3)]"}>
                              <ItemIcon />
                            </span>
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </aside>

            {/* Spacer for fixed sidebar on desktop */}
            <div className={`hidden md:block shrink-0 transition-all duration-300 ${sidebarCollapsed ? "w-0" : "w-[220px]"}`} />

            {/* Main - .main */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 pt-14">
              {/* Topbar - floating, static */}
              <div
                className={`fixed top-0 right-0 h-14 flex items-center justify-between gap-4 z-30 shrink-0 bg-[var(--bg)]/80 backdrop-blur-md border-b border-[var(--brd)]/60 shadow-[0_1px_0_0_rgba(0,0,0,0.05)] transition-all duration-300 ${sidebarCollapsed ? "left-0 pl-2 pr-4 md:pl-3 md:pr-6" : "left-0 px-4 md:left-[220px] md:px-6"}`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
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
                  <div className="min-w-0 flex-1 py-0.5">
                    <h2 className="font-heading text-[15px] font-semibold text-[var(--tx)] truncate leading-tight">{title}</h2>
                    {(subtitle || useClientDate) && (
                      <div className="text-[11px] text-[var(--tx3)] truncate mt-0.5 leading-tight">
                        {useClientDate ? <ClientDate /> : subtitle}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <SearchBox />
                  <NotificationDropdown />
                  <ProfileDropdown user={user} />
                </div>
              </div>

              {/* Content - key forces fade-in on route change */}
              <div key={pathname} className="flex-1 overflow-y-auto overflow-x-hidden animate-fade-in min-h-0">
                {children}
              </div>
            </div>
          </div>
        </ToastProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}
