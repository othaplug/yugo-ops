"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

type PartnerNotification = {
  id: string;
  icon: string;
  title: string;
  body: string | null;
  time: string;
  read: boolean;
  link?: string | null;
  source_type?: string | null;
  created_at?: string;
};

type PartnerNotificationContextType = {
  notifications: PartnerNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
};

function formatRelativeTime(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "Just now";
  if (sec < 120) return "1 min ago";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 172800) return "1 day ago";
  return `${Math.floor(sec / 86400)} days ago`;
}

function mapRow(row: {
  id: string;
  title: string;
  body?: string | null;
  icon?: string | null;
  link?: string | null;
  is_read?: boolean;
  read?: boolean;
  source_type?: string | null;
  created_at?: string;
}): PartnerNotification {
  return {
    id: row.id,
    icon: row.icon || "bell",
    title: row.title,
    body: row.body || null,
    time: row.created_at ? formatRelativeTime(row.created_at) : "Just now",
    read: row.is_read ?? row.read ?? false,
    link: row.link,
    source_type: row.source_type,
    created_at: row.created_at,
  };
}

const PartnerNotificationContext = createContext<PartnerNotificationContextType | undefined>(undefined);

export function PartnerNotificationProvider({ orgId: _orgId, children }: { orgId: string; children: ReactNode }) {
  const [notifications, setNotifications] = useState<PartnerNotification[]>([]);
  const supabase = createClient();

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/partner/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications((data.notifications || []).map(mapRow));
      }
    } catch {
      // Network error: leave notifications unchanged so the app doesn't crash
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Supabase Realtime: listen for new in_app_notifications rows for current user
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel("partner-notifications-realtime")
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
              created_at?: string;
            };
            setNotifications((prev) => [mapRow(row), ...prev.filter((n) => n.id !== row.id)]);
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
    await fetch("/api/partner/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read: true }),
    });
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/partner/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }, []);

  return (
    <PartnerNotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead }}>
      {children}
    </PartnerNotificationContext.Provider>
  );
}

export function usePartnerNotifications() {
  const ctx = useContext(PartnerNotificationContext);
  if (!ctx) throw new Error("usePartnerNotifications must be used within PartnerNotificationProvider");
  return ctx;
}
