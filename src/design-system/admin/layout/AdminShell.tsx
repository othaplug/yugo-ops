"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileBottomNav } from "./MobileBottomNav";
import { CommandPalette } from "./CommandPalette";
import { Yu3PortalProvider } from "./Yu3PortalContext";
import { cn } from "../lib/cn";
import {
  applyDocumentDarkTheme,
  applyDocumentLightTheme,
} from "@/lib/document-theme-tokens";

export interface AdminShellProps {
  children: React.ReactNode;
  user: {
    id?: string;
    email?: string | null;
    full_name?: string | null;
  } | null;
  role: string;
  isSuperAdmin: boolean;
  badges?: { quotes?: number; changeRequests?: number };
  notificationCount?: number;
  breadcrumbs?: { label: string; href?: string }[];
  onSignOut?: () => void;
  /**
   * When both are set, theme is controlled (e.g. admin ThemeContext + document tokens).
   * If omitted, shell reads `yugo-theme` and `yu3.theme` on mount to avoid light yu3 ink on a dark document.
   */
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
}

const STORAGE_COLLAPSED = "yu3.sidebar.collapsed";
const STORAGE_THEME = "yu3.theme";

export function AdminShell({
  children,
  user,
  role,
  isSuperAdmin,
  badges,
  notificationCount = 0,
  breadcrumbs,
  onSignOut,
  theme: themeProp,
  onToggleTheme: onToggleThemeProp,
}: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname() || "/admin";

  const [collapsed, setCollapsed] = React.useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [internalTheme, setInternalTheme] = React.useState<"light" | "dark">(
    "light",
  );
  const [portalNode, setPortalNode] = React.useState<HTMLDivElement | null>(
    null,
  );

  const isThemeControlled = themeProp !== undefined && onToggleThemeProp;
  const theme = isThemeControlled ? themeProp! : internalTheme;

  React.useEffect(() => {
    try {
      const c = localStorage.getItem(STORAGE_COLLAPSED);
      if (c === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    if (isThemeControlled) return;
    try {
      const yu3 = localStorage.getItem(STORAGE_THEME);
      const yugo = localStorage.getItem("yugo-theme");
      if (yu3 === "dark" || yugo === "dark") setInternalTheme("dark");
    } catch {
      /* ignore */
    }
  }, [isThemeControlled]);

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_COLLAPSED, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  React.useEffect(() => {
    if (isThemeControlled) return;
    try {
      localStorage.setItem(STORAGE_THEME, internalTheme);
      localStorage.setItem("yugo-theme", internalTheme);
    } catch {
      /* ignore */
    }
  }, [internalTheme, isThemeControlled]);

  const handleToggleTheme = React.useCallback(() => {
    if (onToggleThemeProp) {
      onToggleThemeProp();
      return;
    }
    setInternalTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      if (next === "dark") applyDocumentDarkTheme();
      else applyDocumentLightTheme();
      return next;
    });
  }, [onToggleThemeProp]);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    let lastKey: { key: string; t: number } | null = null;
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      )
        return;
      if (e.key === "[") {
        setCollapsed((v) => !v);
        return;
      }
      if (e.key.toLowerCase() === "g") {
        lastKey = { key: "g", t: Date.now() };
        return;
      }
      if (lastKey && lastKey.key === "g" && Date.now() - lastKey.t < 1200) {
        const k = e.key.toLowerCase();
        const map: Record<string, string> = {
          h: "/admin",
          l: "/admin/leads",
          q: "/admin/quotes",
          m: "/admin/moves",
          c: "/admin/clients",
          d: "/admin/b2b/jobs",
          p: "/admin/perks",
        };
        if (map[k]) {
          router.push(map[k]!);
          lastKey = null;
          return;
        }
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [router]);

  return (
    <div data-yugo-admin-v3="" data-theme={theme} className="min-h-dvh w-full">
      <Yu3PortalProvider portalNode={portalNode}>
        <div
          className="yu3-shell"
          data-collapsed={collapsed ? "true" : "false"}
        >
          <Sidebar
            role={role}
            isSuperAdmin={isSuperAdmin}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((v) => !v)}
            onNavigate={() => setMobileOpen(false)}
            user={user}
            badges={badges}
            isMobileOpen={mobileOpen}
            onMobileClose={() => setMobileOpen(false)}
          />
          <div className="yu3-main">
            <TopBar
              userEmail={user?.email}
              userName={user?.full_name}
              userRole={role}
              notificationCount={notificationCount}
              theme={theme}
              onToggleTheme={handleToggleTheme}
              onSignOut={onSignOut}
              breadcrumbs={breadcrumbs}
            />
            <main
              id="yu3-main"
              className={cn("yu3-page flex flex-col")}
              data-wide={undefined}
            >
              {children}
            </main>
          </div>
        </div>
        {/* Stacking: Radix portaled UI (tooltips, dropdowns, dialogs) mounts here. The root must sit
            above sidebar (--yu3-z-sidebar 60) and topbar (50), or tooltips hugging the rail render
            behind chrome. Use --yu3-z-drawer (70): still below in-layer modal content (80) and
            palette/toast (90+) which order as siblings inside this tree. */}
        <div
          id="yu3-admin-portal-root"
          ref={setPortalNode}
          className="pointer-events-none fixed inset-0 z-[var(--yu3-z-drawer)] m-0 min-h-0 border-0 p-0 overflow-x-hidden overflow-y-visible"
          aria-hidden
        />

        <MobileBottomNav role={role} isSuperAdmin={isSuperAdmin} />

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </Yu3PortalProvider>
    </div>
  );
}
