"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV = [
  { label: "Dashboard", items: [
    { name: "Command Center", icon: "🎯", href: "/admin" },
    { name: "All Deliveries", icon: "📦", href: "/admin/deliveries" },
    { name: "Calendar", icon: "📅", href: "/admin/calendar" },
    { name: "Crew Tracking", icon: "📍", href: "/admin/crew" },
  ]},
  { label: "B2B Partners", items: [
    { name: "Retail", icon: "🛋️", href: "/admin/partners/retail" },
    { name: "Designers", icon: "🎨", href: "/admin/partners/designers" },
    { name: "Hospitality", icon: "🏨", href: "/admin/partners/hospitality" },
    { name: "Art Gallery", icon: "🖼️", href: "/admin/partners/gallery" },
    { name: "Realtors", icon: "🤝", href: "/admin/partners/realtors" },
  ]},
  { label: "Moves", items: [
    { name: "Residential", icon: "🏠", href: "/admin/moves/residential" },
    { name: "Office", icon: "🏢", href: "/admin/moves/office" },
  ]},
  { label: "Finance", items: [
    { name: "Invoices", icon: "📄", href: "/admin/invoices" },
    { name: "Revenue", icon: "💰", href: "/admin/revenue" },
  ]},
  { label: "System", items: [
    { name: "All Clients", icon: "👥", href: "/admin/clients" },
    { name: "Messages", icon: "💬", href: "/admin/messages" },
    { name: "Settings", icon: "⚙️", href: "/admin/settings" },
  ]},
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[220px] bg-[var(--bg2)] border-r border-[var(--brd)] overflow-y-auto z-50">
      {/* Logo */}
      <div className="px-4 py-[18px] border-b border-[var(--brd)]">
        <span className="font-serif text-lg tracking-[2px]">YUGO</span>
        <span className="text-[8px] font-bold text-[var(--gold)] bg-[var(--gdim)] px-1.5 py-0.5 rounded-full tracking-[1px] ml-1">OPS+</span>
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
                <span className="text-[13px] w-[18px] text-center">{item.icon}</span>
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