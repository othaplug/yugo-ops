"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ToastProvider } from "@/app/admin/components/Toast";
import OfflineBanner from "@/components/ui/OfflineBanner";
import { CrewImmersiveNavContext } from "./CrewImmersiveNavContext";
import { CrewMobileFloatingNav } from "./CrewMobileFloatingNav";
import { cn } from "@/design-system/admin/lib/cn";

const NAV_CORE_LINKS = [
  { href: "/crew/dashboard" as const, label: "Dashboard", shortLabel: "Dash", abbrev: "DB" },
  { href: "/crew/stats" as const, label: "Stats", shortLabel: "Stats", abbrev: "ST" },
  { href: "/crew/expense" as const, label: "Expenses", shortLabel: "Exp", abbrev: "EX" },
  { href: "/crew/end-of-day" as const, label: "End of day", shortLabel: "EOD", abbrev: "ED" },
] as const;

export type ShellNavItem =
  | {
      href: string;
      label: string;
      shortLabel: string;
      abbrev: string;
    }
  | {
      href: string | null;
      label: string;
      shortLabel: string;
      abbrev: string;
      navigation: true;
    };

export default function CrewShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [hasActiveBinTasks, setHasActiveBinTasks] = useState(false);
  const [navTargetPath, setNavTargetPath] = useState<string | null>(null);
  const [immersiveNav, setImmersiveNavState] = useState(false);
  const setImmersiveNav = useCallback((v: boolean) => {
    setImmersiveNavState(v);
  }, []);
  const immersiveNavApi = useMemo(
    () => ({ immersiveNav, setImmersiveNav }),
    [immersiveNav, setImmersiveNav]
  );

  const navItems: ShellNavItem[] = useMemo(() => {
    const navItem: ShellNavItem = {
      href: navTargetPath,
      label: "Navigation",
      shortLabel: "Nav",
      abbrev: "NV",
      navigation: true,
    };
    if (!hasActiveBinTasks) return [NAV_CORE_LINKS[0], navItem, ...NAV_CORE_LINKS.slice(1)];
    const bin: ShellNavItem = {
      href: "/crew/bin-orders",
      label: "Bin tasks",
      shortLabel: "Bins",
      abbrev: "BT",
    };
    return [NAV_CORE_LINKS[0], navItem, bin, ...NAV_CORE_LINKS.slice(1)];
  }, [hasActiveBinTasks, navTargetPath]);

  const isDashboard =
    pathname === "/crew/dashboard" || pathname.startsWith("/crew/dashboard/job/");
  const navigationItem = useMemo(
    () => navItems.find((i) => "navigation" in i && i.navigation),
    [navItems],
  );
  const floatNavigation = useMemo(() => {
    if (!navigationItem) {
      return {
        href: null as string | null,
        shortLabel: "Nav",
        label: "Navigation",
        active: false,
        disabled: true,
      };
    }
    const disabled =
      "navigation" in navigationItem && navigationItem.navigation && !navigationItem.href;
    const navLinkActive = (() => {
      if (!("navigation" in navigationItem) || !navigationItem.navigation) return false;
      if (!navigationItem.href) return false;
      return pathname === navigationItem.href.split("?")[0];
    })();
    return {
      href: navigationItem.href,
      shortLabel: navigationItem.shortLabel,
      label: navigationItem.label,
      active: navLinkActive,
      disabled: Boolean(disabled),
    };
  }, [navigationItem, pathname]);

  useEffect(() => {
    const load = () => {
      fetch("/api/crew/dashboard")
        .then((r) => {
          if (r.status === 401) {
            router.replace("/crew/login");
            return null;
          }
          return r.json();
        })
        .then((d) => {
          if (typeof d?.hasActiveBinTasks === "boolean") setHasActiveBinTasks(d.hasActiveBinTasks);
        })
        .catch(() => {});
    };
    load();
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      load();
    }, 20_000);
    return () => clearInterval(id);
  }, [router, pathname]);

  useEffect(() => {
    fetch("/api/crew/nav-target")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const p = d && typeof d.path === "string" && d.path.length > 0 ? d.path : null;
        setNavTargetPath(p);
      })
      .catch(() => setNavTargetPath(null));
  }, [pathname]);

  return (
    <ToastProvider>
      <CrewImmersiveNavContext.Provider value={immersiveNavApi}>
        <>
          <div className="flex h-dvh max-h-dvh min-h-0 w-full overflow-hidden bg-[var(--yu3-bg-canvas)]">
            <a
              href="#crew-main"
              className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-[var(--yu3-r-md)] focus:bg-[var(--yu3-forest)] focus:text-[var(--yu3-on-forest)] focus:font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--yu3-forest-tint)]"
            >
              Skip to main content
            </a>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
              <main
                id="crew-main"
                key={pathname}
                className={cn(
                  "relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y tab-content",
                  "bg-[var(--yu3-bg-canvas)]",
                  "px-4",
                  immersiveNav
                    ? "pt-0 pb-0"
                    : "pt-4 pb-[var(--admin-mobile-nav-bar)]",
                )}
              >
                {children}
              </main>
            </div>
          </div>
          <CrewMobileFloatingNav
            show={!immersiveNav}
            pathname={pathname}
            isDashboard={isDashboard}
            navigation={floatNavigation}
            hasActiveBinTasks={hasActiveBinTasks}
          />
        </>
      </CrewImmersiveNavContext.Provider>
      <OfflineBanner />
    </ToastProvider>
  );
}
