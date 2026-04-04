"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "./NotificationContext";
import type { Notification } from "./NotificationContext";
import { Icon } from "@/components/AppIcons";

const SOURCE_TAGS: Record<string, { label: string; color: string; bg: string }> = {
  delivery: { label: "Delivery", color: "#2C3E2D", bg: "rgba(201,169,98,0.12)" },
  quote: { label: "Quote", color: "#6B8CFF", bg: "rgba(107,140,255,0.12)" },
  move: { label: "Move", color: "#2D9F5A", bg: "rgba(45,159,90,0.12)" },
  payment: { label: "Payment", color: "#2D9F5A", bg: "rgba(45,159,90,0.12)" },
  claim: { label: "Claim", color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  system: { label: "System", color: "var(--tx3)", bg: "var(--gdim)" },
};

export default function NotificationDropdown() {
  const router = useRouter();
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

  function getHref(notif: Notification): string {
    if (notif.link) return notif.link;
    if (notif.source_type === "delivery") return "/admin/deliveries";
    if (notif.source_type === "quote") return "/admin/quotes";
    if (notif.source_type === "move") return "/admin/moves";
    if (notif.source_type === "payment") return "/admin/invoices";
    if (notif.source_type === "claim") return "/admin/claims";
    return "/admin";
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative size-8 rounded-lg border border-[var(--brd)] bg-[var(--card)] hover:bg-[var(--gdim)] hover:border-[var(--gold)] transition-all duration-200 flex items-center justify-center touch-manipulation shrink-0"
      >
        <Icon name="bell" className="w-[14px] h-[14px] shrink-0 stroke-[1.75] stroke-current text-[var(--tx2)]" />
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[var(--red)] text-white text-[8px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[9999] mt-2 w-[min(380px,calc(100dvw-1.5rem))] max-w-[380px] overflow-hidden rounded-xl border border-[var(--brd)] bg-[var(--bg2)] shadow-2xl animate-fade-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--brd)]">
            <div className="font-heading text-[13px] font-bold text-[var(--tx)]">Notifications</div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[440px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-[11px] text-[var(--tx3)]">
                No notifications yet
              </div>
            ) : (
              notifications.map((notif) => {
                const href = getHref(notif);
                const tag = notif.source_type ? SOURCE_TAGS[notif.source_type] : null;
                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      markAsRead(notif.id);
                      setOpen(false);
                      router.push(href);
                    }}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-[var(--brd)] last:border-b-0 hover:bg-[var(--gdim)] cursor-pointer transition-colors w-full text-left border-t-0 border-x-0 ${
                      !notif.read ? "bg-[var(--gdim)]" : "bg-transparent"
                    }`}
                  >
                    {/* Unread dot */}
                    <div className="flex-shrink-0 mt-1.5 w-3 flex items-center justify-center">
                      {!notif.read && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--gold)] opacity-50" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--gold)]" />
                        </span>
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className={`text-[11px] leading-snug ${!notif.read ? "font-bold text-[var(--tx)]" : "font-normal text-[var(--tx2)]"}`}>
                          {notif.title}
                        </div>
                        {tag && (
                          <span
                            className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                            style={{ color: tag.color, backgroundColor: tag.bg }}
                          >
                            {tag.label}
                          </span>
                        )}
                      </div>
                      {notif.body && (
                        <div className="text-[10px] text-[var(--tx3)] mt-0.5 truncate">
                          {notif.body}
                        </div>
                      )}
                      <div className="text-[9px] text-[var(--tx3)]/60 mt-1">{notif.time}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--brd)] px-4 py-2.5 text-center">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/admin/notifications");
              }}
              className="admin-view-all-link w-full justify-center py-1"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
