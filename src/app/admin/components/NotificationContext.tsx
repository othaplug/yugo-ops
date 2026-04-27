"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

export type Notification = {
  id: string;
  icon: string;
  title: string;
  body: string | null;
  time: string;
  read: boolean;
  link?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  event_slug?: string | null;
  created_at?: string;
};

type NotificationContextType = {
  notifications: Notification[];
  /** True after the first GET /api/admin/notifications attempt completes (ok or not). */
  listLoaded: boolean;
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (notif: Omit<Notification, "id" | "read"> & { id?: string } | { id: string; title: string; icon?: string; body?: string | null; link?: string | null; source_type?: string | null; created_at?: string; is_read?: boolean }) => void;
};

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "Just now";
  if (sec < 120) return "1 min ago";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 172800) return "1 day ago";
  return `${Math.floor(sec / 86400)} days ago`;
}

function mapDbToNotification(row: {
  id: string;
  title: string;
  body?: string | null;
  icon?: string | null;
  link?: string | null;
  is_read?: boolean;
  read?: boolean;
  source_type?: string | null;
  source_id?: string | null;
  event_slug?: string | null;
  created_at?: string;
}): Notification {
  return {
    id: row.id,
    icon: row.icon || "bell",
    title: row.title,
    body: row.body || null,
    time: row.created_at ? formatRelativeTime(row.created_at) : "Just now",
    read: row.is_read ?? row.read ?? false,
    link: row.link,
    source_type: row.source_type,
    source_id: row.source_id,
    event_slug: row.event_slug,
    created_at: row.created_at,
  };
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const supabase = createClient();

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications");
      if (res.ok) {
        const data = await res.json();
        const rows = data.notifications || [];
        setNotifications(rows.map(mapDbToNotification));
      }
    } catch {
      // Network error or server down: leave notifications unchanged so the app doesn't crash
    } finally {
      setListLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Polling fallback every 30s to catch any missed realtime events
  useEffect(() => {
    const interval = setInterval(loadNotifications, 30_000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Supabase Realtime: listen for new in_app_notifications rows for current user
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel("admin-notif-realtime")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "in_app_notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const row = payload.new as {
              id: string;
              title: string;
              body?: string | null;
              icon?: string | null;
              link?: string | null;
              is_read?: boolean;
              source_type?: string | null;
              source_id?: string | null;
              event_slug?: string | null;
              created_at?: string;
            };
            setNotifications((prev) => [mapDbToNotification(row), ...prev.filter((n) => n.id !== row.id)]);
          }
        )
        .subscribe();
    };

    setup();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Refresh relative times every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          time: n.created_at ? formatRelativeTime(n.created_at) : n.time,
        }))
      );
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read: true }),
    });
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }, [notifications]);

  const addNotification = useCallback(
    (
      notif:
        | (Omit<Notification, "id" | "read"> & { id?: string })
        | { id: string; title: string; icon?: string; body?: string | null; link?: string | null; source_type?: string | null; created_at?: string; is_read?: boolean }
    ) => {
      const n: Notification =
        "created_at" in notif && notif.created_at
          ? mapDbToNotification(notif as Parameters<typeof mapDbToNotification>[0])
          : {
              ...(notif as Omit<Notification, "id" | "read">),
              id: (notif as { id?: string }).id ?? crypto.randomUUID(),
              read: false,
              time: (notif as { time?: string }).time || "Just now",
            };
      setNotifications((prev) => [n, ...prev.filter((p) => p.id !== n.id)]);
    },
    []
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        listLoaded,
        unreadCount,
        markAsRead,
        markAllAsRead,
        addNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within NotificationProvider");
  return context;
}
