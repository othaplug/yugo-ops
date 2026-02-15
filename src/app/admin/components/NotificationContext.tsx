"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Notification = {
  id: string;
  icon: string;
  title: string;
  time: string;
  read: boolean;
};

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (notif: Omit<Notification, "id" | "read">) => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: "1", icon: "🎉", title: "New delivery created: DEL-1047", time: "2 min ago", read: false },
    { id: "2", icon: "💰", title: "Invoice INV-2891 paid", time: "1 hour ago", read: false },
    { id: "3", icon: "📧", title: "Message from Restoration Hardware", time: "3 hours ago", read: true },
    { id: "4", icon: "🚚", title: "Delivery DEL-1046 completed", time: "5 hours ago", read: true },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const addNotification = (notif: Omit<Notification, "id" | "read">) => {
    setNotifications(prev => [
      { ...notif, id: Date.now().toString(), read: false },
      ...prev
    ]);
  };

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