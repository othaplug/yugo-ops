"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  MagnifyingGlass,
  Truck,
  CurrencyDollar,
  ChatText,
  GearSix,
  CheckCircle,
  EnvelopeSimple,
  X,
  FileText,
  Camera,
  CalendarBlank,
  ClockClockwise,
  ListBullets,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import BackButton from "../components/BackButton";
import {
  type ActivityEventRow,
  formatActivityTime,
  formatActivityDescription,
} from "../components/activity-feed-shared";

const CORE_TYPES = ["move", "delivery", "invoice", "quote"] as const;
type KnownEntityType = (typeof CORE_TYPES)[number];
type TypeFilter = KnownEntityType | "system" | "all";

const TYPE_PILLS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "move", label: "Move" },
  { key: "delivery", label: "Delivery" },
  { key: "invoice", label: "Invoice" },
  { key: "quote", label: "Quote" },
  { key: "system", label: "System" },
];

const DATE_PRESETS = [
  { key: "all" as const, label: "All time" },
  { key: "24h" as const, label: "24h" },
  { key: "7d" as const, label: "7d" },
  { key: "30d" as const, label: "30d" },
];

function normalizeEntityType(t: string | null | undefined): string {
  return (t || "").trim().toLowerCase();
}

function isKnownEntityType(t: string): t is KnownEntityType {
  return (CORE_TYPES as readonly string[]).includes(t);
}

function getEntityHref(e: ActivityEventRow): string | null {
  const t = normalizeEntityType(e.entity_type);
  if (t === "move" && e.entity_id) return `/admin/moves/${e.entity_id}`;
  if (t === "delivery") return e.entity_id ? `/admin/deliveries/${e.entity_id}` : "/admin/deliveries";
  if (t === "invoice") return "/admin/invoices";
  if (t === "quote" && e.entity_id) return `/admin/quotes/${e.entity_id}/edit`;
  return null;
}

function entityBadgeLabel(entityType: string): string {
  const t = normalizeEntityType(entityType);
  const map: Record<string, string> = {
    move: "Move",
    delivery: "Delivery",
    invoice: "Invoice",
    quote: "Quote",
  };
  if (map[t]) return map[t];
  if (!t) return "Unknown";
  return t
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function humanizeEventType(eventType: string): string {
  if (!eventType) return "-";
  return eventType
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function looksLikeEmojiOrGlyph(icon: string): boolean {
  const t = icon.trim();
  if (!t) return false;
  if (/^[\w_-]+$/.test(t)) return false;
  return true;
}

function EventGlyph({ icon, entityType }: { icon: string | null; entityType: string }) {
  const size = 16;
  const cls = "shrink-0 text-[var(--tx3)]";
  if (icon && looksLikeEmojiOrGlyph(icon)) {
    return (
      <span className="text-[15px] leading-none w-4 h-4 flex items-center justify-center" aria-hidden>
        {icon}
      </span>
    );
  }
  const key = (icon || "").toLowerCase().replace(/\s+/g, "_");
  switch (key) {
    case "check":
      return <CheckCircle size={size} className={cls} weight="duotone" aria-hidden />;
    case "truck":
    case "delivery":
      return <Truck size={size} className={cls} weight="duotone" aria-hidden />;
    case "mail":
      return <EnvelopeSimple size={size} className={cls} weight="duotone" aria-hidden />;
    case "x":
      return <X size={size} className={cls} weight="duotone" aria-hidden />;
    case "file":
      return <FileText size={size} className={cls} weight="duotone" aria-hidden />;
    case "dollar":
      return <CurrencyDollar size={size} className={cls} weight="duotone" aria-hidden />;
    case "camera":
      return <Camera size={size} className={cls} weight="duotone" aria-hidden />;
    case "calendar":
      return <CalendarBlank size={size} className={cls} weight="duotone" aria-hidden />;
    case "follow_up":
      return <ClockClockwise size={size} className={cls} weight="duotone" aria-hidden />;
    default: {
      const et = normalizeEntityType(entityType);
      if (et === "move") return <Truck size={size} className={cls} weight="duotone" aria-hidden />;
      if (et === "delivery") return <Truck size={size} className={cls} weight="duotone" aria-hidden />;
      if (et === "invoice") return <CurrencyDollar size={size} className={cls} weight="duotone" aria-hidden />;
      if (et === "quote") return <ChatText size={size} className={cls} weight="duotone" aria-hidden />;
      return <ListBullets size={size} className={cls} weight="duotone" aria-hidden />;
    }
  }
}

function matchesDatePreset(createdAt: string, preset: (typeof DATE_PRESETS)[number]["key"]): boolean {
  if (preset === "all") return true;
  const t = new Date(createdAt).getTime();
  const now = Date.now();
  const ms = { "24h": 24 * 60 * 60 * 1000, "7d": 7 * 24 * 60 * 60 * 1000, "30d": 30 * 24 * 60 * 60 * 1000 }[preset];
  return now - t <= ms;
}

export default function AuditLogClient({ events }: { events: ActivityEventRow[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [datePreset, setDatePreset] = useState<(typeof DATE_PRESETS)[number]["key"]>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (!matchesDatePreset(e.created_at, datePreset)) return false;
      const et = normalizeEntityType(e.entity_type);
      if (typeFilter === "all") {
        /* no-op */
      } else if (typeFilter === "system") {
        if (isKnownEntityType(et)) return false;
      } else if (et !== typeFilter) {
        return false;
      }
      if (!q) return true;
      const hay = [
        e.description,
        e.event_type,
        e.entity_type,
        e.entity_id,
        e.icon,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [events, search, typeFilter, datePreset]);

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-5 md:px-6 py-4 sm:py-5 md:py-6 animate-fade-up min-w-0">
      <div className="mb-5">
        <BackButton label="Back" fallback="/admin" />
      </div>

      <div className="mb-6">
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/70 mb-1.5">Operations</p>
        <h1 className="font-hero text-[22px] sm:text-[28px] font-bold text-[var(--tx)] tracking-tight leading-tight">
          Audit log
        </h1>
        <p className="text-[12px] text-[var(--tx3)] mt-2 font-medium leading-snug max-w-xl">
          Status and activity events across moves, deliveries, billing, and quotes. Showing the latest 200 entries.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] shadow-[0_1px_0_rgba(255,255,255,0.04)] overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-[var(--brd)] bg-[var(--bg)]/40 space-y-3">
          <div className="relative">
            <MagnifyingGlass
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx3)] pointer-events-none"
              size={16}
              weight="regular"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(ev) => setSearch(ev.target.value)}
              placeholder="Search description, type, entity id…"
              className="w-full rounded-xl border border-[var(--brd)] bg-[var(--bg)] pl-9 pr-3 py-2.5 text-[12px] text-[var(--tx)] placeholder:text-[var(--tx3)] outline-none focus:border-[var(--gold)]/45 focus:ring-1 focus:ring-[var(--gold)]/25 transition-shadow"
              aria-label="Filter audit events"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex flex-wrap gap-1.5">
              {TYPE_PILLS.map((p) => {
                const active = typeFilter === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setTypeFilter(p.key)}
                    className={`rounded-xl px-2.5 py-1.5 text-[11px] font-semibold border transition-colors ${
                      active
                        ? "border-[var(--gold)]/50 bg-[var(--gdim)] text-[var(--gold)]"
                        : "border-[var(--brd)] bg-[var(--card)] text-[var(--tx2)] hover:border-[var(--brd)] hover:text-[var(--tx)]"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mr-0.5">When</span>
              {DATE_PRESETS.map((d) => {
                const active = datePreset === d.key;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setDatePreset(d.key)}
                    className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${
                      active
                        ? "bg-[var(--gold)]/15 text-[var(--gold)]"
                        : "text-[var(--tx3)] hover:text-[var(--tx2)]"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <GearSix className="mx-auto mb-3 text-[var(--tx3)]" size={28} weight="duotone" aria-hidden />
            <p className="text-[12px] font-semibold text-[var(--tx2)]">No events match your filters</p>
            <p className="text-[11px] text-[var(--tx3)] mt-1">Try clearing search or widening the time range.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead>
                  <tr className="bg-[var(--bg)]/30">
                    <th className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-4 py-2.5 border-b border-[var(--brd)] w-[120px]">
                      Time
                    </th>
                    <th className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-4 py-2.5 border-b border-[var(--brd)] w-[100px]">
                      Entity
                    </th>
                    <th className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-4 py-2.5 border-b border-[var(--brd)] w-[140px]">
                      Event
                    </th>
                    <th className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-4 py-2.5 border-b border-[var(--brd)]">
                      Description
                    </th>
                    <th className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-4 py-2.5 border-b border-[var(--brd)] w-[100px] text-right">
                      Link
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => {
                    const href = getEntityHref(e);
                    const desc = formatActivityDescription(e.description || e.event_type);
                    return (
                      <tr
                        key={e.id}
                        className="border-b border-[var(--brd)]/60 hover:bg-[var(--bg)]/25 transition-colors"
                      >
                        <td className="px-4 py-3 align-top whitespace-nowrap">
                          <div className="flex items-start gap-2">
                            <EventGlyph icon={e.icon} entityType={e.entity_type} />
                            <span
                              className="text-[11px] font-medium text-[var(--tx2)] tabular-nums cursor-default"
                              title={new Date(e.created_at).toLocaleString()}
                            >
                              {formatActivityTime(e.created_at)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className="inline-flex items-center rounded-lg border border-[var(--brd)] bg-[var(--bg)]/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--tx2)]">
                            {entityBadgeLabel(e.entity_type)}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className="text-[11px] font-semibold text-[var(--tx)] leading-snug">
                            {humanizeEventType(e.event_type)}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <p className="text-[12px] text-[var(--tx2)] leading-snug line-clamp-3">{desc}</p>
                        </td>
                        <td className="px-4 py-3 align-top text-right">
                          {href ? (
                            <Link
                              href={href}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--gold)] hover:underline"
                            >
                              Open
                              <ArrowSquareOut size={14} weight="bold" aria-hidden />
                            </Link>
                          ) : (
                            <span className="text-[11px] text-[var(--tx3)]">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="md:hidden divide-y divide-[var(--brd)]">
              {filtered.map((e) => {
                const href = getEntityHref(e);
                const desc = formatActivityDescription(e.description || e.event_type);
                const inner = (
                  <div className="flex gap-3 py-3.5 px-4">
                    <div className="pt-0.5">
                      <EventGlyph icon={e.icon} entityType={e.entity_type} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center rounded-lg border border-[var(--brd)] bg-[var(--bg)]/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--tx2)]">
                          {entityBadgeLabel(e.entity_type)}
                        </span>
                        <span className="text-[11px] font-semibold text-[var(--tx)]">{humanizeEventType(e.event_type)}</span>
                      </div>
                      <p className="text-[12px] text-[var(--tx2)] mt-1.5 leading-snug">{desc}</p>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <span className="text-[11px] text-[var(--tx3)] font-medium">{formatActivityTime(e.created_at)}</span>
                        {href ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--gold)]">
                            View
                            <ArrowSquareOut size={14} weight="bold" aria-hidden />
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--tx3)]">-</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
                return href ? (
                  <li key={e.id}>
                    <Link href={href} className="block active:bg-[var(--bg)]/40">
                      {inner}
                    </Link>
                  </li>
                ) : (
                  <li key={e.id}>{inner}</li>
                );
              })}
            </ul>
          </>
        )}

        <div className="px-4 py-2.5 border-t border-[var(--brd)] bg-[var(--bg)]/25 flex items-center justify-between gap-2">
          <span className="text-[11px] text-[var(--tx3)] font-medium">
            Showing {filtered.length} of {events.length} loaded
          </span>
          <Link
            href="/admin/activity"
            className="text-[11px] font-semibold text-[var(--gold)] hover:underline"
          >
            Live activity feed
          </Link>
        </div>
      </div>
    </div>
  );
}
