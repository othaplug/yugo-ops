"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToastProvider } from "./Toast";
import { NotificationProvider } from "./NotificationContext";
import { ThemeProvider } from "./ThemeContext";
import NotificationDropdown from "./NotificationDropdown";
import SearchBox from "./SearchBox";

const SIDEBAR_SECTIONS = [
  {
    label: "Dashboard",
    items: [
      { href: "/admin", label: "Command Center", icon: "🎯" },
      { href: "/admin/deliveries", label: "All Deliveries", icon: "📦" },
      { href: "/admin/calendar", label: "Calendar", icon: "📅" },
      { href: "/admin/crew", label: "Crew Tracking", icon: "📍" },
    ],
  },
  {
    label: "B2B Partners",
    items: [
      { href: "/admin/partners/retail", label: "Retail", icon: "🛋️" },
      { href: "/admin/partners/designers", label: "Designers", icon: "🎨" },
      { href: "/admin/partners/hospitality", label: "Hospitality", icon: "🏨" },
      { href: "/admin/partners/gallery", label: "Art Gallery", icon: "🖼️" },
      { href: "/admin/partners/realtors", label: "Realtors", icon: "🤝" },
    ],
  },
  {
    label: "Moves",
    items: [
      { href: "/admin/moves/residential", label: "Residential", icon: "🏠" },
      { href: "/admin/moves/office", label: "Office / Commercial", icon: "🏢" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/admin/invoices", label: "Invoices", icon: "📄" },
      { href: "/admin/revenue", label: "Revenue", icon: "💰" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/clients", label: "All Clients", icon: "👥" },
      { href: "/admin/messages", label: "Messages", icon: "💬" },
      { href: "/admin/settings", label: "Settings", icon: "⚙️" },
    ],
  },
];

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/admin": { title: "Command Center", subtitle: new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) },
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
  "/admin/settings": { title: "Settings", subtitle: "Configuration" },
  "/admin/platform": { title: "Platform Settings", subtitle: "Pricing, crews & partners" },
};

function getPageTitle(pathname: string): { title: string; subtitle: string } {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/admin/deliveries/")) return { title: "Delivery Detail", subtitle: "" };
  if (pathname.startsWith("/admin/clients/")) return { title: "Client Detail", subtitle: "" };
  if (pathname.startsWith("/admin/deliveries/new")) return { title: "New Delivery", subtitle: "" };
  return { title: "OPS+", subtitle: "" };
}

export default function AdminShell({ user, children }: { user: any; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { title, subtitle } = getPageTitle(pathname);

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

            {/* Sidebar - matches prototype .sb */}
            <aside className={`
              fixed md:sticky top-0 left-0 z-50 h-screen w-[220px]
              bg-[var(--bg2)] border-r border-[var(--brd)] overflow-y-auto
              flex flex-col transition-transform duration-200 ease-out
              ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
            `}>
              {/* Logo - .sb-hd */}
              <div className="px-4 py-[18px] border-b border-[var(--brd)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="font-serif text-[18px] tracking-[2px] text-[var(--tx)]">YUGO</span>
                    <span className="text-[8px] font-bold tracking-[1px] text-[var(--gold)] bg-[var(--gdim)] px-[6px] py-[2px] rounded-[10px] ml-1">
                      OPS+
                    </span>
                  </div>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="md:hidden p-1.5 rounded-[8px] hover:bg-[var(--card)] transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--tx2)" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Nav sections */}
              <nav className="flex-1 py-2">
                {SIDEBAR_SECTIONS.map((section) => (
                  <div key={section.label} className="py-2">
                    <div className="text-[9px] font-bold tracking-[0.8px] uppercase text-[var(--tx3)] px-4 pt-2 pb-1">
                      {section.label}
                    </div>
                    {section.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-2 px-4 py-[7px] text-[11px] font-medium transition-all border-l-2 ${
                          isActive(item.href)
                            ? "bg-[var(--gdim)] text-[var(--gold)] border-l-[var(--gold)] font-semibold"
                            : "text-[var(--tx2)] hover:bg-[var(--gdim)] hover:text-[var(--tx)] border-l-transparent"
                        }`}
                      >
                        <span className="text-[13px] w-[18px] text-center">{item.icon}</span>
                        <span>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                ))}
              </nav>

              {/* Footer - .sb-ft */}
              <div className="px-4 py-3 border-t border-[var(--brd)] mt-auto">
                <Link
                  href="/admin/settings"
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-2 p-1.5 rounded-[8px] hover:bg-[var(--gdim)] transition-all cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--gold)] to-[#8B7332] flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                    {user?.email?.split("@")[0]?.slice(0, 2).toUpperCase() || "JO"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold text-[var(--tx)] truncate">
                      {user?.email?.split("@")[0] || "Admin"}
                    </div>
                    <div className="text-[8px] text-[var(--tx3)]">Admin</div>
                  </div>
                </Link>
              </div>
            </aside>

            {/* Main - .main */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 md:ml-0">
              {/* Topbar - .topbar */}
              <div className="flex items-center justify-between gap-2 px-4 md:px-6 py-3 border-b border-[var(--brd)] bg-[var(--bg2)] sticky top-0 z-30">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="md:hidden min-w-[44px] min-h-[44px] -m-2 flex items-center justify-center rounded-[8px] hover:bg-[var(--card)] active:bg-[var(--gdim)] transition-colors touch-manipulation text-[var(--tx2)]"
                    aria-label="Open menu"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                  </button>
                  <div className="min-w-0">
                    <h2 className="text-[14px] font-semibold text-[var(--tx)] truncate">{title}</h2>
                    {subtitle && <div className="text-[10px] text-[var(--tx3)] truncate">{subtitle}</div>}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <SearchBox />
                  <NotificationDropdown />
                </div>
              </div>

              {/* Content - .cnt */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                {children}
              </div>
            </div>
          </div>
        </ToastProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}
