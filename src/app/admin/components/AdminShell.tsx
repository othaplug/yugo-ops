"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ToastProvider } from "./Toast";

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
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-[var(--bg)]">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/70 z-40 md:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar - HIDDEN on mobile unless hamburger clicked */}
        <aside className={`
          fixed md:sticky top-0 left-0 z-50 h-screen w-[240px]
          bg-[var(--bg2)] border-r border-[var(--brd)]
          flex flex-col transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}>
          {/* Logo */}
          <div className="px-5 py-6 border-b border-[var(--brd)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[20px] font-bold tracking-[3px] text-[var(--tx)]">YUGO</div>
                <div className="text-[9px] font-bold tracking-[2px] text-[var(--gold)] mt-0.5">OPS+</div>
              </div>
              {/* Close button - mobile only */}
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden p-1.5 rounded-lg hover:bg-[var(--card)] transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--tx2)" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 py-3 px-3 overflow-y-auto">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[12px] font-medium transition-all mb-1 ${
                  isActive(item.href)
                    ? "bg-[var(--gdim)] text-[var(--gold)] border border-[var(--gold)]/20 shadow-sm"
                    : "text-[var(--tx2)] hover:text-[var(--tx)] hover:bg-[var(--card)]"
                }`}
              >
                <span className="text-[15px]">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Bottom: User + Logout */}
          <div className="px-3 py-3 border-t border-[var(--brd)] space-y-2">
            <div className="px-3 py-2">
              <div className="text-[11px] font-semibold text-[var(--tx)] truncate">{user.email}</div>
              <div className="text-[9px] text-[var(--tx3)]">Admin</div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-[12px] font-medium text-[var(--tx3)] hover:text-[var(--red)] hover:bg-[rgba(209,67,67,0.06)] transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile Header - ONLY on mobile */}
          <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-[var(--brd)] bg-[var(--bg2)] sticky top-0 z-30">
            {/* Hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-[var(--card)] transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--tx)" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* Logo */}
            <div className="flex flex-col items-center">
              <div className="text-[16px] font-bold tracking-[2px] text-[var(--tx)]">YUGO</div>
              <div className="text-[7px] font-bold tracking-[1.5px] text-[var(--gold)]">OPS+</div>
            </div>

            {/* Bell + Settings */}
            <div className="flex items-center gap-1">
              <button className="p-2 rounded-lg hover:bg-[var(--card)] transition-colors relative">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--tx2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--gold)] rounded-full" />
              </button>
              <Link href="/admin/settings" className="p-2 rounded-lg hover:bg-[var(--card)] transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--tx2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Desktop: Bell + Settings in top-right */}
          <div className="hidden md:flex items-center justify-end gap-2 px-6 py-2.5 border-b border-[var(--brd)] bg-[var(--bg2)]">
            <button className="p-2 rounded-lg hover:bg-[var(--card)] transition-colors relative" title="Notifications">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--tx2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--gold)] rounded-full" />
            </button>
            <Link href="/admin/settings" className="p-2 rounded-lg hover:bg-[var(--card)] transition-colors" title="Settings">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--tx2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}