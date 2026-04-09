"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Icon } from "@/components/AppIcons";
import YugoLogo from "@/components/YugoLogo";
import { createClient } from "@/lib/supabase/client";
import { User } from "@phosphor-icons/react";

const NAV = [
  { label: "Dashboard", items: [
    { name: "Command Center", icon: "home", href: "/admin" },
    { name: "Reports", icon: "fileText", href: "/admin/reports" },
    { name: "Calendar", icon: "calendar", href: "/admin/calendar" },
    { name: "Tracking", icon: "mapPin", href: "/admin/crew" },
  ]},
  { label: "B2B", items: [
    { name: "Jobs", icon: "mapPin", href: "/admin/deliveries", badge: "pending_deliveries" },
    { name: "Retail", icon: "sofa", href: "/admin/partners/retail" },
    { name: "Designers", icon: "palette", href: "/admin/partners/designers" },
    { name: "Hospitality", icon: "hotel", href: "/admin/partners/hospitality" },
    { name: "Art Gallery", icon: "image", href: "/admin/partners/gallery" },
    { name: "Referral Partners", icon: "handshake", href: "/admin/partners/realtors" },
  ]},
  { label: "Moves", items: [
    { name: "All Moves", icon: "truck", href: "/admin/moves" },
    { name: "Move Projects", icon: "calendar", href: "/admin/move-projects" },
    { name: "Quotes", icon: "fileText", href: "/admin/quotes", badge: "pending_quotes" },
  ]},
  { label: "Finance", items: [
    { name: "Invoices", icon: "fileText", href: "/admin/invoices" },
    { name: "Revenue", icon: "dollarSign", href: "/admin/revenue" },
    { name: "Tips", icon: "dollarSign", href: "/admin/tips" },
    { name: "Profitability", icon: "dollarSign", href: "/admin/finance/profitability", ownerOnly: true },
  ]},
  { label: "CRM", items: [
    { name: "Contacts", icon: "users", href: "/admin/clients" },
    { name: "Perks & Referrals", icon: "gift", href: "/admin/perks" },
    { name: "Settings", icon: "settings", href: "/admin/settings" },
  ]},
];

export default function Sidebar() {
  const pathname = usePathname();
  const [pendingDeliveriesCount, setPendingDeliveriesCount] = useState(0);
  const [pendingQuotesCount, setPendingQuotesCount] = useState(0);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // Fetch pending deliveries count
    supabase
      .from("deliveries")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_approval")
      .then(({ count }) => setPendingDeliveriesCount(count || 0))
      .then(undefined, () => {});

    // Fetch pending quotes count (sent but not yet accepted)
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .is("accepted_at", null)
      .then(({ count }) => setPendingQuotesCount(count || 0))
      .then(undefined, () => {});

    // Fetch current user role for owner-only items
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("platform_users")
        .select("role")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => setUserRole(data?.role ?? null))
        .then(undefined, () => {});
    });
  }, [pathname]);

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[220px] bg-[var(--bg2)] border-r border-[var(--brd)] overflow-y-auto z-50">
      {/* Logo */}
      <div className="px-5 py-[18px] border-b border-[var(--brd)]">
        <YugoLogo size={18} />
      </div>

      {/* Nav Sections */}
      {NAV.map((section) => (
        <div key={section.label} className="py-2">
          <div className="text-[9px] font-bold tracking-[0.06em] uppercase text-[var(--tx2)] px-4 py-1 [font-family:var(--font-body)]">
            {section.label}
          </div>
          {section.items.map((item) => {
            const ownerOnly = (item as { ownerOnly?: boolean }).ownerOnly;
            if (ownerOnly && userRole !== "owner") return null;

            const isActive = pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));

            let badgeCount = 0;
            if ((item as { badge?: string }).badge === "pending_deliveries") badgeCount = pendingDeliveriesCount;
            if ((item as { badge?: string }).badge === "pending_quotes") badgeCount = pendingQuotesCount;

            return (
              <Link
                key={`${section.label}-${item.name}`}
                href={item.href}
                className={`sidebar-nav-lift flex items-center gap-2 px-4 py-[7px] mx-2 rounded-none text-[11px] font-medium border-l-2 -ml-px
                  ${isActive
                    ? "bg-[color-mix(in_srgb,var(--yu-accent)_20%,transparent)] text-[var(--tx)] border-l-[var(--yu-accent)] font-semibold"
                    : "text-[var(--tx2)] border-transparent hover:bg-[color-mix(in_srgb,var(--yu-accent)_12%,transparent)] hover:text-[var(--tx)]"
                  }`}
              >
                <span className={`sidebar-icon transition-colors duration-150 ${isActive ? "text-[var(--tx)]" : "text-[var(--tx3)]"}`}>
                  <Icon name={item.icon} className="w-[15px] h-[15px]" />
                </span>
                <span className="flex-1">{item.name}</span>
                {badgeCount > 0 && (
                  <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-[2px] bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] text-[9px] font-bold px-1">{badgeCount}</span>
                )}
              </Link>
            );
          })}
        </div>
      ))}

      {/* User Footer */}
      <div className="mt-auto px-4 py-3 border-t border-[var(--brd)]">
        <Link href="/admin/settings" className="sidebar-nav-lift flex items-center gap-2 p-1.5 mx-2 rounded-[2px] hover:bg-[var(--gdim)]">
          <div className="w-7 h-7 rounded-[2px] bg-[var(--admin-primary-fill)] flex items-center justify-center text-[9px] font-bold text-[var(--btn-text-on-accent)]">
            <User size={14} className="text-[var(--btn-text-on-accent)]" aria-hidden />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-[var(--tx)]">Settings</div>
            <div className="text-[9px] font-bold uppercase tracking-[0.06em] text-[var(--tx2)]">
              Account
            </div>
          </div>
        </Link>
      </div>
    </aside>
  );
}
