"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

type Notification = {
  id: string;
  icon: string;
  title: string;
  time: string;
  read: boolean;
  link?: string;
};

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (notif: Omit<Notification, "id" | "read"> & { id?: string } | { id: string; title: string; icon?: string; link?: string; created_at?: string }) => void;
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

function mapDbToNotification(row: { id: string; title: string; icon?: string; link?: string; read?: boolean; created_at?: string }): Notification {
  return {
    id: row.id,
    icon: row.icon || "bell",
    title: row.title,
    time: row.created_at ? formatRelativeTime(row.created_at) : "Just now",
    read: !!row.read,
    link: row.link,
  };
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const loadNotifications = async () => {
      const res = await fetch("/api/admin/notifications");
      if (res.ok) {
        const data = await res.json();
        const rows = data.notifications || [];
        setNotifications(rows.map(mapDbToNotification));
      }
    };
    loadNotifications();
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
      body: JSON.stringify({ all: true, read: true }),
    });
  }, [notifications]);

  const addNotification = useCallback((notif: Omit<Notification, "id" | "read"> & { id?: string } | { id: string; title: string; icon?: string; link?: string; created_at?: string }) => {
    const n: Notification =
      "created_at" in notif && notif.created_at
        ? mapDbToNotification(notif as { id: string; title: string; icon?: string; link?: string; created_at?: string })
        : {
            ...(notif as Omit<Notification, "id" | "read">),
            id: (notif as { id?: string }).id ?? crypto.randomUUID(),
            read: false,
            time: (notif as { time?: string }).time || "Just now",
          };
    setNotifications((prev) => [n, ...prev.filter((p) => p.id !== n.id)]);
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, addNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within NotificationProvider");
  return context;
}
