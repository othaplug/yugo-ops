"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Lock } from "@phosphor-icons/react";
import { cn } from "@/design-system/admin/lib/cn";

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
 * Settings hub navigation: Workspace / Operations / Platform plus Change log.
 * Styling uses Yu3 tokens to match the overview cards.
 */
export default function SettingsHubNav({
  isPartner,
  showOperations,
  showPlatform,
}: Props) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const platformTab = searchParams?.get("tab") || "pricing";

  const hubPath =
    pathname === "/admin/settings" || pathname === "/admin/settings/";
  if (hubPath) {
    return null;
  }

  const workspaceItems: NavItem[] = isPartner
    ? [{ href: "/admin/settings/personal", label: "Personal & profile" }]
    : [
        { href: "/admin/settings/personal", label: "Personal & profile" },
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
      href: "/admin/settings/platform/integrations",
      label: "Integrations",
      platformTab: "app",
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
    cn(
      "rounded-[var(--yu3-r-md)] px-3 py-2 text-[13px] font-medium transition-colors outline-none",
      "focus-visible:ring-2 focus-visible:ring-[var(--yu3-wine)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--yu3-bg-canvas)]",
      active
        ? "bg-[var(--yu3-wine-wash)] text-[var(--yu3-wine)] font-semibold"
        : "text-[var(--yu3-ink-muted)] hover:bg-[var(--yu3-bg-surface-sunken)] hover:text-[var(--yu3-ink)]",
    );

  const renderGroup = (
    label: string,
    items: NavItem[],
    opts?: { locked?: boolean },
  ) => (
    <div className="space-y-1">
      <div className="flex items-center gap-1 px-2 pb-1 pt-2 first:pt-0">
        <span
          className="text-[10px] font-bold uppercase tracking-[var(--yu3-tracking-eyebrow)] text-[var(--yu3-ink-faint)] leading-none"
        >
          {label}
        </span>
        {opts?.locked && (
          <Lock
            size={11}
            weight="bold"
            className="text-[var(--yu3-ink-faint)] shrink-0"
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
              className={linkClass(active)}
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

  const navStickyClass =
    "hidden sm:flex flex-col w-[240px] shrink-0 self-start sticky z-[var(--yu3-z-rail)] pr-3 border-r border-[var(--yu3-line-subtle)] min-h-[16rem]";
  const stickyTopStyle = {
    top: "var(--yu3-sticky-subnav-offset)",
  } as const;

  return (
    <>
      <nav
        aria-label="Settings sections"
        className={navStickyClass}
        style={stickyTopStyle}
      >
        {renderGroup("Workspace", workspaceItems)}
        {showOperations && renderGroup("Operations", operationsItems)}
        {showPlatform && renderGroup("Platform", platformItems, { locked: true })}
        <div className="mt-auto pt-6 border-t border-[var(--yu3-line-subtle)]">
          <Link
            href="/admin/settings/audit-log"
            className={linkClass(auditActive)}
          >
            Change log
          </Link>
        </div>
      </nav>

      <div className="sm:hidden space-y-4 mb-4">
        {renderGroup("Workspace", workspaceItems)}
        {showOperations && renderGroup("Operations", operationsItems)}
        {showPlatform && renderGroup("Platform", platformItems, { locked: true })}
        <Link
          href="/admin/settings/audit-log"
          className={cn(
            linkClass(auditActive),
            "border border-[var(--yu3-line-subtle)]",
          )}
        >
          Change log
        </Link>
      </div>
    </>
  );
}
