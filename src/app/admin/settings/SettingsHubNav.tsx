"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Lock } from "@phosphor-icons/react";

type NavItem = {
  href: string;
  label: string;
  /** For /admin/platform passthrough links, which ?tab= counts as active */
  platformTab?: string;
};

type Props = {
  isPartner: boolean;
  showOperations: boolean;
  showPlatform: boolean;
};

/**
 * PR 2 settings hub navigation. Renders three role-gated groups
 * (Workspace / Operations / Platform) plus an always-visible Audit log
 * link. The Operations and Platform items redirect to today's real pages
 * (legacy /admin/platform tabs and standalone admin routes); later PRs
 * will move the content onto the new route tree.
 */
export default function SettingsHubNav({
  isPartner,
  showOperations,
  showPlatform,
}: Props) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const platformTab = searchParams?.get("tab") || "pricing";

  const workspaceItems: NavItem[] = isPartner
    ? [{ href: "/admin/settings/personal", label: "Profile" }]
    : [
        { href: "/admin/settings/personal", label: "Profile" },
        { href: "/admin/settings/security", label: "Security" },
        { href: "/admin/settings/appearance", label: "Appearance" },
        { href: "/admin/settings/notifications", label: "Notifications" },
        { href: "/admin/settings/integrations", label: "Integrations" },
      ];

  const operationsItems: NavItem[] = [
    { href: "/admin/settings/operations/team", label: "Team" },
    { href: "/admin/settings/operations/business-info", label: "Business info" },
    { href: "/admin/settings/operations/email-templates", label: "Email templates" },
    { href: "/admin/settings/operations/quote-page", label: "Quote page" },
    { href: "/admin/settings/operations/partners", label: "Partners" },
  ];

  const platformItems: NavItem[] = [
    {
      href: "/admin/settings/platform/feature-flags",
      label: "Feature flags",
      platformTab: "app",
    },
    {
      href: "/admin/settings/platform/integrations",
      label: "Integrations",
      platformTab: "app",
    },
    {
      href: "/admin/settings/platform/developer",
      label: "Developer",
      platformTab: "devices",
    },
  ];

  const itemActive = (item: NavItem): boolean => {
    if (item.platformTab) {
      return (
        pathname.startsWith("/admin/platform") && platformTab === item.platformTab
      );
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  const linkClass = (active: boolean) =>
    active
      ? "bg-[var(--color-wine-subtle)] text-[var(--color-text-primary)] font-semibold"
      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]";

  const renderGroup = (
    label: string,
    items: NavItem[],
    opts?: { locked?: boolean },
  ) => (
    <div className="space-y-1">
      <div className="flex items-center gap-1 px-2 pb-1 pt-2 first:pt-0">
        <span className="t-label text-[var(--color-text-tertiary)]">{label}</span>
        {opts?.locked && (
          <Lock
            size={11}
            weight="bold"
            className="text-[var(--color-text-tertiary)] shrink-0"
            aria-hidden
          />
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = itemActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-[13px] transition-colors ${linkClass(active)}`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );

  const auditActive =
    pathname.startsWith("/admin/settings/audit-log") ||
    pathname.startsWith("/admin/audit-log");

  return (
    <>
      <nav
        aria-label="Settings sections"
        className="hidden sm:flex flex-col w-[240px] shrink-0 sticky top-[4.5rem] pr-3 border-r border-[var(--brd)]/30 min-h-[16rem]"
      >
        {renderGroup("Workspace", workspaceItems)}
        {showOperations && renderGroup("Operations", operationsItems)}
        {showPlatform && renderGroup("Platform", platformItems, { locked: true })}
        <div className="mt-auto pt-6 border-t border-[var(--brd)]/25">
          <Link
            href="/admin/settings/audit-log"
            className={`block rounded-lg px-3 py-2 text-[13px] transition-colors ${linkClass(auditActive)}`}
          >
            Audit log
          </Link>
        </div>
      </nav>

      <div className="sm:hidden space-y-4 mb-4">
        {renderGroup("Workspace", workspaceItems)}
        {showOperations && renderGroup("Operations", operationsItems)}
        {showPlatform && renderGroup("Platform", platformItems, { locked: true })}
        <Link
          href="/admin/settings/audit-log"
          className={`block rounded-lg px-3 py-2 text-[13px] border border-[var(--brd)]/40 ${linkClass(auditActive)}`}
        >
          Audit log
        </Link>
      </div>
    </>
  );
}
