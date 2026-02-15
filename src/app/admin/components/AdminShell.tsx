"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToastProvider } from "./Toast";
import { NotificationProvider } from "./NotificationContext";
import { ThemeProvider } from "./ThemeContext";
import NotificationDropdown from "./NotificationDropdown";
import ProfileDropdown from "./ProfileDropdown";

const NAV = [
  { href: "/admin", label: "Command Center", icon: "⚡" },
  { href: "/admin/deliveries", label: "Deliveries", icon: "📦" },
  { href: "/admin/invoices", label: "Invoices", icon: "💰" },
  { href: "/admin/clients", label: "Clients", icon: "👥" },
  { href: "/admin/moves", label: "Moves", icon: "🚚" },
  { href: "/admin/crew", label: "Crew Tracking", icon: "📍" },
  { href: "/admin/messages", label: "Messages", icon: "💬" },
  { href: "/admin/revenue", label: "Revenue", icon: "📊" },
];

export default function AdminShell({ user, children }: { user: any; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

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

            {/* Sidebar */}
            <aside className={`
              fixed md:sticky top-0 left-0 z-50 h-screen w-[220px]
              bg-[var(--bg2)] border-r border-[var(--brd)]
              flex flex-col transition-transform duration-300 ease-in-out
              ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
            `}>
              {/* Logo */}
              <div className="px-4 py-[18px] border-b border-[var(--brd)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <div className="text-[18px] font-bold tracking-[2px] text-[var(--tx)]">YUGO</div>
                    <div className="text-[8px] font-bold tracking-[1px] text-[var(--gold)] bg-[var(--gdim)] px-[6px] py-[2px] rounded-[10px]">
                      OPS+
                    </div>
                  </div>
                  {/* Close button - mobile only */}
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="md:hidden p-1.5 rounded-lg hover:bg-[var(--card)] transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--tx2)" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Nav */}
              <nav className="flex-1 py-2 overflow-y-auto">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-2 px-4 py-[7px] text-[11px] font-medium transition-all border-l-2 ${
                      isActive(item.href)
                        ? "bg-[var(--gdim)] text-[var(--gold)] border-l-[var(--gold)] font-semibold"
                        : "text-[var(--tx2)] hover:text-[var(--tx)] hover:bg-[var(--gdim)] border-l-transparent"
                    }`}
                  >
                    <span className="text-[13px] w-[18px] text-center">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </nav>

              {/* Bottom: User */}
              <div className="px-3 py-3 border-t border-[var(--brd)]">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--gdim)] cursor-pointer transition-all">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--gold)] to-[#8B7332] flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                    {user?.email?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold text-[var(--tx)] truncate">{user?.email}</div>
                    <div className="text-[8px] text-[var(--tx3)]">Admin</div>
                  </div>
                </div>
              </div>
            </aside>

            {/* Main */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Topbar */}
              <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-[var(--brd)] bg-[var(--bg2)] sticky top-0 z-30">
                {/* Left: Hamburger (mobile) */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden p-2 rounded-lg hover:bg-[var(--card)] transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--tx)" strokeWidth="2" strokeLinecap="round">
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </button>

                {/* Center: Logo (mobile) */}
                <div className="flex md:hidden flex-col items-center">
                  <div className="text-[14px] font-bold tracking-[2px] text-[var(--tx)]">YUGO</div>
                  <div className="text-[7px] font-bold tracking-[1px] text-[var(--gold)]">OPS+</div>
                </div>

                {/* Right: Notifications + Profile */}
                <div className="flex items-center gap-2">
                  <NotificationDropdown />
                  <ProfileDropdown user={user} />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                {children}
              </div>
            </div>
          </div>
        </ToastProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}