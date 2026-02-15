"use client";

import { useState, useRef, useEffect } from "react";
import { useNotifications } from "./NotificationContext";
import { Icon } from "@/components/AppIcons";

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative size-9 rounded-lg border border-[var(--brd)] bg-[var(--card)] hover:bg-[var(--gdim)] hover:border-[var(--gold)] transition-all duration-200 flex items-center justify-center touch-manipulation shrink-0"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--tx2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--red)] text-white text-[8px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(320px,calc(100vw-2rem))] max-w-[320px] bg-[var(--bg2)] border border-[var(--brd)] rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-up">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--brd)]">
            <div className="font-heading text-[13px] font-bold">Notifications</div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-[11px] text-[var(--tx3)]">
                No notifications
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-[var(--brd)] hover:bg-[var(--gdim)] cursor-pointer transition-colors ${
                    !notif.read ? "bg-[var(--gdim)]" : ""
                  }`}
                >
                  {!notif.read && (
                    <div className="w-2 h-2 rounded-full bg-[var(--gold)] mt-1.5 flex-shrink-0" />
                  )}
                  <div className="flex-shrink-0 text-[var(--tx2)]"><Icon name={notif.icon} className="w-[18px] h-[18px]" /></div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11px] ${!notif.read ? "font-semibold text-[var(--tx)]" : "text-[var(--tx2)]"}`}>
                      {notif.title}
                    </div>
                    <div className="text-[9px] text-[var(--tx3)] mt-0.5">{notif.time}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}