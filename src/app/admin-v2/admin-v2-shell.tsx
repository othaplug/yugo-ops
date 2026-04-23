"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ThemeProvider } from "@/components/admin-v2/providers/theme-provider";
import { QueryProvider } from "@/components/admin-v2/providers/query-provider";
import { AdminShell, type AdminShellUser } from "@/components/admin-v2/layout";
import { CommandPalette } from "@/components/admin-v2/modules/command-palette";
import { NotificationsDrawer } from "@/components/admin-v2/modules/notifications-drawer";
import { useSidebarStore } from "@/components/admin-v2/stores/sidebar-store";
import { useTheme } from "@/components/admin-v2/providers/theme-provider";

type AdminV2ShellProps = {
  user: AdminShellUser;
  children: React.ReactNode;
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable === true
  );
};

const GlobalShortcuts: React.FC<{
  onToggleCommand: () => void;
  onToggleNotifications: () => void;
}> = ({ onToggleCommand, onToggleNotifications }) => {
  const toggleSidebar = useSidebarStore((s) => s.toggleCollapsed);
  const { setTheme, resolvedTheme } = useTheme();

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onToggleCommand();
        return;
      }
      if (meta && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleSidebar();
        return;
      }
      if (meta && event.key.toLowerCase() === "d") {
        event.preventDefault();
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
        return;
      }
      if (
        !meta &&
        event.key.toLowerCase() === "n" &&
        !isEditableTarget(event.target)
      ) {
        onToggleNotifications();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    onToggleCommand,
    onToggleNotifications,
    toggleSidebar,
    setTheme,
    resolvedTheme,
  ]);

  return null;
};

export const AdminV2Shell = ({ user, children }: AdminV2ShellProps) => {
  const router = useRouter();
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);

  const handleSignOut = React.useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }, [router]);

  return (
    <ThemeProvider>
      <QueryProvider>
        <AdminShell
          user={user}
          onSignOut={handleSignOut}
          onOpenCommandPalette={() => setCommandOpen(true)}
          onOpenNotifications={() => setNotificationsOpen(true)}
          unreadNotifications={2}
        >
          {children}
        </AdminShell>
        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
        <NotificationsDrawer
          open={notificationsOpen}
          onOpenChange={setNotificationsOpen}
        />
        <GlobalShortcuts
          onToggleCommand={() => setCommandOpen((v) => !v)}
          onToggleNotifications={() => setNotificationsOpen((v) => !v)}
        />
      </QueryProvider>
    </ThemeProvider>
  );
};
