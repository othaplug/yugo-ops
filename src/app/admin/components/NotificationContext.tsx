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
  addNotification: (notif: Omit<Notification, "id" | "read">) => void;
};

const STORAGE_KEY = "yugo-notifications";
const DEFAULT: Notification[] = [
  { id: "1", icon: "party", title: "New delivery created: PJ1047", time: "2 min ago", read: false, link: "/admin/deliveries" },
  { id: "2", icon: "dollar", title: "Invoice INV-2891 paid", time: "1 hour ago", read: false, link: "/admin/invoices" },
  { id: "3", icon: "mail", title: "Message from Restoration Hardware", time: "3 hours ago", read: true, link: "/admin/messages" },
  { id: "4", icon: "truck", title: "Delivery PJ1046 completed", time: "5 hours ago", read: true, link: "/admin/deliveries" },
];

function getLinkForNotification(notif: { icon?: string; title?: string }): string {
  const t = (notif.title || "").toLowerCase();
  const icon = notif.icon || "";
  if (t.includes("change request") || icon === "clipboard") return "/admin/change-requests";
  if (t.includes("delivery") || icon === "truck" || icon === "party") return "/admin/deliveries";
  if (t.includes("invoice") || icon === "dollar") return "/admin/invoices";
  if (t.includes("message") || icon === "mail") return "/admin/messages";
  return "/admin";
}

function loadNotifications(): Notification[] {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Notification[];
      return parsed.map((n) => ({
        ...n,
        link: n.link || getLinkForNotification(n),
      }));
    }
  } catch {}
  return DEFAULT;
}

function saveNotifications(notifications: Notification[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch {}
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(DEFAULT);

  useEffect(() => {
    setNotifications(loadNotifications());
  }, []);

  useEffect(() => {
    saveNotifications(notifications);
  }, [notifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const addNotification = useCallback((notif: Omit<Notification, "id" | "read"> & { link?: string }) => {
    setNotifications(prev => [
      { ...notif, id: Date.now().toString(), read: false },
      ...prev
    ]);
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