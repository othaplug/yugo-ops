"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { id: "personal", label: "Personal", labelPartner: "Profile" },
  { id: "security", label: "Security" },
  { id: "appearance", label: "Appearance" },
  { id: "notifications", label: "Notifications" },
  { id: "integrations", label: "Integrations" },
] as const;

export type SettingsTabId = (typeof TABS)[number]["id"];

export default function SettingsTabs({ isPartner }: { isPartner: boolean }) {
  const pathname = usePathname();
  const activeTab = pathname.split("/").pop() || "personal";

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-[var(--brd)] pb-3">
      {TABS.map((tab) => {
        const href = `/admin/settings/${tab.id}`;
        const label = tab.id === "personal" && isPartner ? tab.labelPartner : tab.label;
        const isActive = activeTab === tab.id;
        return (
          <Link
            key={tab.id}
            href={href}
            className={`text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-all ${
              isActive
                ? "bg-[var(--gold)] text-white"
                : "text-[var(--gold)] hover:bg-[var(--gold)]/10"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
