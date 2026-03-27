"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Icon } from "@/components/AppIcons";
import { useToast } from "../components/Toast";

interface NotifEvent {
  id: string;
  event_slug: string;
  event_name: string;
  description: string;
  category: string;
  supports_email: boolean;
  supports_sms: boolean;
  supports_push: boolean;
  display_order: number;
}

interface NotifPref {
  event_slug: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
}

const CATEGORY_ORDER = ["quotes", "moves", "payments", "crew", "partners", "system"];
const CATEGORY_LABELS: Record<string, string> = {
  quotes: "Quotes",
  moves: "Moves",
  payments: "Payments",
  crew: "Crew",
  partners: "Partners",
  system: "System",
};

const CHANNEL_ICON_NAMES: Record<string, string> = {
  email: "mail",
  sms: "messageSquare",
  push: "bell",
};

export default function NotificationToggles() {
  const { toast } = useToast();
  const [events, setEvents] = useState<NotifEvent[]>([]);
  const [prefs, setPrefs] = useState<Record<string, NotifPref>>({});
  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSavedToast = useCallback(() => {
    if (savedToastTimerRef.current) clearTimeout(savedToastTimerRef.current);
    savedToastTimerRef.current = setTimeout(() => {
      toast("Notification preferences saved", "check");
      savedToastTimerRef.current = null;
    }, 500);
  }, [toast]);

  useEffect(() => {
    fetch("/api/admin/notifications")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.events)) setEvents(data.events);
        if (Array.isArray(data.preferences)) {
          const map: Record<string, NotifPref> = {};
          for (const p of data.preferences) {
            map[p.event_slug] = p;
          }
          setPrefs(map);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getPref = (slug: string): NotifPref => {
    return prefs[slug] || { event_slug: slug, email_enabled: true, sms_enabled: false, push_enabled: true };
  };

  const savePref = useCallback((slug: string, pref: NotifPref) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      fetch("/api/admin/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pref),
      }).catch(() => {});
    }, 300);
  }, []);

  const toggleChannel = (slug: string, channel: "email" | "sms" | "push") => {
    const current = getPref(slug);
    const key = `${channel}_enabled` as keyof NotifPref;
    const updated = { ...current, [key]: !current[key as keyof NotifPref] };
    setPrefs((prev) => ({ ...prev, [slug]: updated }));
    savePref(slug, updated);
  };

  const masterToggle = async (channel: "email" | "sms" | "push") => {
    const key = `${channel}_enabled` as "email_enabled" | "sms_enabled" | "push_enabled";
    const allOn = events.every((e) => getPref(e.event_slug)[key]);
    const newVal = !allOn;

    const updated: Record<string, NotifPref> = { ...prefs };
    for (const e of events) {
      const current = getPref(e.event_slug);
      updated[e.event_slug] = { ...current, [key]: newVal };
    }
    setPrefs(updated);

    try {
      const res = await fetch("/api/admin/notifications/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, enabled: newVal }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(typeof data.error === "string" ? data.error : "Failed to update all rows", "x");
        return;
      }
      toast(`All ${channel} notifications ${newVal ? "enabled" : "disabled"}`, "check");
    } catch {
      toast("Failed to save master toggle", "x");
    }
  };

  const masterState = (channel: "email" | "sms" | "push"): boolean => {
    if (events.length === 0) return false;
    const key = `${channel}_enabled` as "email_enabled" | "sms_enabled" | "push_enabled";
    return events.every((e) => getPref(e.event_slug)[key]);
  };

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    items: events.filter((e) => e.category === cat),
  })).filter((g) => g.items.length > 0);

  if (loading) {
    return <div className="py-8 text-center text-[12px] text-[var(--tx3)]">Loading notifications...</div>;
  }

  if (events.length === 0) {
    return <div className="py-8 text-center text-[12px] text-[var(--tx3)]">No notification events configured.</div>;
  }

  return (
    <div className="space-y-5">
      {/* Master toggles */}
      <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-[var(--brd)]">
        <span className="text-[10px] font-bold tracking-wider capitalize text-[var(--tx3)]">Master:</span>
        {(["email", "sms", "push"] as const).map((ch) => {
          const on = masterState(ch);
          return (
            <button
              key={ch}
              type="button"
              onClick={() => masterToggle(ch)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                on
                  ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]"
                  : "border border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--gold)]"
              }`}
            >
              <Icon name={CHANNEL_ICON_NAMES[ch] ?? "bell"} style={{ width: 14, height: 14 }} />
              All {ch.charAt(0).toUpperCase() + ch.slice(1)}: {on ? "ON" : "OFF"}
            </button>
          );
        })}
      </div>

      {/* Category groups */}
      {grouped.map((group) => (
        <div key={group.category}>
          <div className="text-[10px] font-bold tracking-wider capitalize text-[var(--tx3)] mb-2">{group.label}</div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden divide-y divide-[var(--brd)]">
            {group.items.map((event) => {
              const pref = getPref(event.event_slug);
              return (
                <div key={event.event_slug} className="flex items-center justify-between px-4 py-3 gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-[var(--tx)]">{event.event_name}</div>
                    <div className="text-[11px] text-[var(--tx3)] mt-0.5">{event.description}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {event.supports_email && (
                      <button
                        type="button"
                        onClick={() => toggleChannel(event.event_slug, "email")}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-base)] transition-all ${
                          pref.email_enabled
                            ? "bg-[var(--gold)]/20 text-[var(--gold)]"
                            : "bg-[var(--bg)] text-[var(--tx3)] opacity-40 hover:opacity-70"
                        }`}
                        title={`Email: ${pref.email_enabled ? "ON" : "OFF"}`}
                      >
                        <Icon name="mail" className="w-4 h-4 shrink-0 stroke-[1.75] stroke-current" />
                      </button>
                    )}
                    {event.supports_sms && (
                      <button
                        type="button"
                        onClick={() => toggleChannel(event.event_slug, "sms")}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-base)] transition-all ${
                          pref.sms_enabled
                            ? "bg-[var(--gold)]/20 text-[var(--gold)]"
                            : "bg-[var(--bg)] text-[var(--tx3)] opacity-40 hover:opacity-70"
                        }`}
                        title={`SMS: ${pref.sms_enabled ? "ON" : "OFF"}`}
                      >
                        <Icon name="messageSquare" className="w-4 h-4 shrink-0 stroke-[1.75] stroke-current" />
                      </button>
                    )}
                    {event.supports_push && (
                      <button
                        type="button"
                        onClick={() => toggleChannel(event.event_slug, "push")}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-base)] transition-all ${
                          pref.push_enabled
                            ? "bg-[var(--gold)]/20 text-[var(--gold)]"
                            : "bg-[var(--bg)] text-[var(--tx3)] opacity-40 hover:opacity-70"
                        }`}
                        title={`Push: ${pref.push_enabled ? "ON" : "OFF"}`}
                      >
                        <Icon name="bell" className="w-4 h-4 shrink-0 stroke-[1.75] stroke-current" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
