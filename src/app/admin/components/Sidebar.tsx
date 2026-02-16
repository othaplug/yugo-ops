"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/AppIcons";

const NAV = [
  { label: "Dashboard", items: [
    { name: "Command Center", icon: "target", href: "/admin" },
    { name: "All Projects", icon: "projects", href: "/admin/deliveries" },
    { name: "Calendar", icon: "calendar", href: "/admin/calendar" },
    { name: "Tracking", icon: "mapPin", href: "/admin/crew" },
  ]},
  { label: "B2B Partners", items: [
    { name: "Retail", icon: "sofa", href: "/admin/partners/retail" },
    { name: "Designers", icon: "palette", href: "/admin/partners/designers" },
    { name: "Hospitality", icon: "hotel", href: "/admin/partners/hospitality" },
    { name: "Art Gallery", icon: "image", href: "/admin/partners/gallery" },
    { name: "Realtors", icon: "handshake", href: "/admin/partners/realtors" },
  ]},
  { label: "Moves", items: [
    { name: "Residential", icon: "home", href: "/admin/moves/residential" },
    { name: "Office", icon: "building", href: "/admin/moves/office" },
  ]},
  { label: "Finance", items: [
    { name: "Invoices", icon: "fileText", href: "/admin/invoices" },
    { name: "Revenue", icon: "dollarSign", href: "/admin/revenue" },
  ]},
  { label: "CRM", items: [
    { name: "All Clients", icon: "users", href: "/admin/clients" },
    { name: "Messages", icon: "messageSquare", href: "/admin/messages" },
    { name: "Settings", icon: "settings", href: "/admin/settings" },
  ]},
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[220px] bg-[var(--bg2)] border-r border-[var(--brd)] overflow-y-auto z-50">
      {/* Logo */}
      <div className="px-4 py-[18px] border-b border-[var(--brd)]">
        <span className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-[rgba(201,169,98,0.06)] backdrop-blur-xl border border-[rgba(201,169,98,0.35)] text-[var(--gold)] font-heading text-[13px] font-semibold tracking-[3px] shadow-[0_0_24px_rgba(201,169,98,0.06),inset_0_1px_0_rgba(255,255,255,0.03)]">
          OPS+
        </span>
      </div>

      {/* Nav Sections */}
      {NAV.map((section) => (
        <div key={section.label} className="py-2">
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-4 py-1">
            {section.label}
          </div>
          {section.items.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-[7px] text-[11px] font-medium border-l-2 transition-all duration-100
                  ${isActive 
                    ? "bg-[var(--gdim)] text-[var(--gold)] border-[var(--gold)] font-semibold" 
                    : "text-[var(--tx2)] border-transparent hover:bg-[var(--gdim)] hover:text-[var(--tx)]"
                  }`}
              >
                <span className="text-[var(--tx3)]"><Icon name={item.icon} className="w-[15px] h-[15px]" /></span>
                {item.name}
              </Link>
            );
          })}
        </div>
      ))}

      {/* User Footer */}
      <div className="mt-auto px-4 py-3 border-t border-[var(--brd)]">
        <Link href="/admin/settings" className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--gdim)] transition-all">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--gold)] to-[#8B7332] flex items-center justify-center text-[9px] font-bold text-white">
            JO
          </div>
          <div>
            <div className="text-[10px] font-semibold">J. Oche</div>
            <div className="text-[8px] text-[var(--tx3)]">Admin</div>
          </div>
        </Link>
      </div>
    </aside>
  );
}