"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "@phosphor-icons/react";
import { useNotifications } from "./NotificationContext";
import type { Notification } from "./NotificationContext";

const SOURCE_TAGS: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  delivery: { label: "Delivery", color: "#2C3E2D", bg: "var(--gdim, rgba(0,0,0,0.04))" },
  quote: { label: "Quote", color: "#6B8CFF", bg: "rgba(107,140,255,0.12)" },
  move: { label: "Move", color: "#2D9F5A", bg: "rgba(45,159,90,0.12)" },
  payment: { label: "Payment", color: "#2D9F5A", bg: "rgba(45,159,90,0.12)" },
  claim: { label: "Claim", color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  building: { label: "Building", color: "#6B635C", bg: "rgba(107,99,92,0.14)" },
  system: { label: "System", color: "var(--yu3-ink-muted)", bg: "var(--gdim, rgba(0,0,0,0.04))" },
};

const SNEAK_PEEK_LIMIT = 5;

/**
 * TopBar bell button with a sneak-peek dropdown of the 5 most recent notifications.
 * Footer "View all" link routes to /admin/notifications.
 *
 * Visually matches the TopBar pill style (round, surface background) so it slots
 * cleanly into AdminShell via the `notificationSlot` prop.
 */
export default function TopBarNotificationDropdown() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function getHref(notif: Notification): string {
    if (notif.link) return notif.link;
    if (notif.source_type === "delivery") return "/admin/deliveries";
    if (notif.source_type === "quote") return "/admin/quotes";
    if (notif.source_type === "move") return "/admin/moves";
    if (notif.source_type === "payment") return "/admin/invoices";
    if (notif.source_type === "claim") return "/admin/claims";
    if (notif.source_type === "building") return "/admin/buildings";
    return "/admin/notifications";
  }

  const recent = notifications.slice(0, SNEAK_PEEK_LIMIT);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex items-center justify-center h-9 w-9 md:h-10 md:w-10 rounded-full shrink-0 bg-[var(--yu3-topbar-search-bg)] text-[var(--yu3-ink)] hover:brightness-95"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Bell size={16} weight="regular" className="text-[var(--yu3-ink-muted)]" />
        {unreadCount > 0 ? (
          <span
            className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[var(--yu3-topbar-search-bg)] z-[1]"
            aria-hidden
          />
        ) : null}
        {unreadCount > 0 ? (
          <span
            className="absolute -top-0.5 -right-0.5 z-[2] min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center"
            aria-hidden
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[9999] mt-2 w-[min(380px,calc(100dvw-1.5rem))] max-w-[380px] overflow-hidden rounded-xl border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] shadow-xl animate-fade-up"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--yu3-line)]">
            <div className="text-[13px] font-bold text-[var(--yu3-ink)]">Notifications</div>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  markAllAsRead();
                }}
                className="text-[10px] font-semibold text-[var(--yu3-wine)] hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {recent.length === 0 ? (
              <div className="px-4 py-10 text-center text-[11px] text-[var(--yu3-ink-muted)]">
                No notifications yet
              </div>
            ) : (
              recent.map((notif) => {
                const href = getHref(notif);
                const tag = notif.source_type
                  ? SOURCE_TAGS[notif.source_type]
                  : null;
                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => {
                      markAsRead(notif.id);
                      setOpen(false);
                      router.push(href);
                    }}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-[var(--yu3-line)] last:border-b-0 hover:bg-[var(--yu3-bg-surface-sunken)] cursor-pointer transition-colors w-full text-left ${
                      !notif.read
                        ? "bg-[var(--yu3-bg-surface-sunken)]/60"
                        : ""
                    }`}
                  >
                    <div className="flex-shrink-0 mt-1.5 w-3 flex items-center justify-center">
                      {!notif.read && (
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--yu3-wine)] opacity-50 animate-ping" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--yu3-wine)]" />
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className={`text-[11px] leading-snug ${
                            !notif.read
                              ? "font-bold text-[var(--yu3-ink)]"
                              : "font-normal text-[var(--yu3-ink-muted)]"
                          }`}
                        >
                          {notif.title}
                        </div>
                        {tag ? (
                          <span
                            className="shrink-0 text-[10px] font-bold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-sm border border-[var(--yu3-line)]/50"
                            style={{
                              color: tag.color,
                              backgroundColor: tag.bg,
                            }}
                          >
                            {tag.label}
                          </span>
                        ) : null}
                      </div>
                      {notif.body ? (
                        <div className="text-[10px] text-[var(--yu3-ink-muted)] mt-0.5 truncate">
                          {notif.body}
                        </div>
                      ) : null}
                      <div className="text-[9px] text-[var(--yu3-ink-muted)]/82 mt-1">
                        {notif.time}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-[var(--yu3-line)] px-4 py-2.5 text-center">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/admin/notifications");
              }}
              className="text-[11px] font-semibold text-[var(--yu3-wine)] hover:underline w-full"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
