"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UserCircle,
  ShieldCheck,
  PaintBrush,
  Bell,
  Plugs,
} from "@phosphor-icons/react";

const TABS = [
  { id: "personal",      label: "Personal",      desc: "Name, phone & role",         Icon: UserCircle,  labelPartner: "Profile" },
  { id: "security",      label: "Security",       desc: "Password & 2FA",             Icon: ShieldCheck },
  { id: "appearance",    label: "Appearance",     desc: "Theme & display",            Icon: PaintBrush },
  { id: "notifications", label: "Notifications",  desc: "Alerts & preferences",       Icon: Bell },
  { id: "integrations",  label: "Integrations",   desc: "Connected services",         Icon: Plugs },
] as const;

export type SettingsTabId = (typeof TABS)[number]["id"];

export default function SettingsTabs({ isPartner }: { isPartner: boolean }) {
  const pathname = usePathname();
  const activeTab = pathname.split("/").pop() || "personal";

  return (
    <>
      {/* Desktop: vertical sidebar */}
      <nav className="hidden sm:flex flex-col gap-0.5 w-[168px] shrink-0 sticky top-[4.5rem]">
        {TABS.map((tab) => {
          const TabIcon = tab.Icon;
          const active = activeTab === tab.id;
          const label = tab.id === "personal" && isPartner ? tab.labelPartner : tab.label;
          return (
            <Link
              key={tab.id}
              href={`/admin/settings/${tab.id}`}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                active
                  ? "bg-[var(--gdim)] text-[var(--gold)]"
                  : "text-[var(--tx3)] hover:bg-[var(--gdim)]/50 hover:text-[var(--tx)]"
              }`}
            >
              <TabIcon
                size={16}
                weight={active ? "fill" : "regular"}
                className={`shrink-0 transition-colors ${active ? "text-[var(--gold)]" : "text-[var(--tx3)] group-hover:text-[var(--tx2)]"}`}
              />
              <div className="min-w-0">
                <div className={`text-[12px] font-semibold leading-tight truncate ${active ? "text-[var(--gold)]" : ""}`}>
                  {label}
                </div>
                <div className="text-[10px] text-[var(--tx3)] leading-tight truncate mt-0.5 hidden lg:block">
                  {tab.desc}
                </div>
              </div>
              {active && <span className="ml-auto w-1 h-1 rounded-full bg-[var(--gold)] shrink-0" />}
            </Link>
          );
        })}
      </nav>

      {/* Mobile: horizontal scrollable pills */}
      <div className="sm:hidden flex overflow-x-auto gap-1 pb-2 mb-4 -mx-1 px-1 scrollbar-hide w-full">
        {TABS.map((tab) => {
          const TabIcon = tab.Icon;
          const active = activeTab === tab.id;
          const label = tab.id === "personal" && isPartner ? tab.labelPartner : tab.label;
          return (
            <Link
              key={tab.id}
              href={`/admin/settings/${tab.id}`}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all shrink-0 ${
                active
                  ? "bg-[var(--gdim)] text-[var(--gold)] border border-[var(--gold)]/30"
                  : "text-[var(--tx3)] border border-transparent hover:bg-[var(--gdim)]/50"
              }`}
            >
              <TabIcon size={13} weight={active ? "fill" : "regular"} />
              {label}
            </Link>
          );
        })}
      </div>
    </>
  );
}
