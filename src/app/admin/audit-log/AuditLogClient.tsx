"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Truck,
  CurrencyDollar,
  ChatText,
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
import DataTable, { type ColumnDef } from "@/components/admin/DataTable";
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
  if (t === "delivery")
    return e.entity_id
      ? `/admin/deliveries/${e.entity_id}`
      : "/admin/deliveries";
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
  if (!eventType) return "Event";
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

function EventGlyph({
  icon,
  entityType,
}: {
  icon: string | null;
  entityType: string;
}) {
  const size = 16;
  const cls = "shrink-0 text-[var(--tx3)]";
  if (icon && looksLikeEmojiOrGlyph(icon)) {
    return (
      <span
        className="text-[15px] leading-none w-4 h-4 flex items-center justify-center"
        aria-hidden
      >
        {icon}
      </span>
    );
  }
  const key = (icon || "").toLowerCase().replace(/\s+/g, "_");
  switch (key) {
    case "check":
      return (
        <CheckCircle size={size} className={cls} weight="duotone" aria-hidden />
      );
    case "truck":
    case "delivery":
      return <Truck size={size} className={cls} weight="duotone" aria-hidden />;
    case "mail":
      return (
        <EnvelopeSimple
          size={size}
          className={cls}
          weight="duotone"
          aria-hidden
        />
      );
    case "x":
      return <X size={size} className={cls} weight="duotone" aria-hidden />;
    case "file":
      return (
        <FileText size={size} className={cls} weight="duotone" aria-hidden />
      );
    case "dollar":
      return (
        <CurrencyDollar
          size={size}
          className={cls}
          weight="duotone"
          aria-hidden
        />
      );
    case "camera":
      return (
        <Camera size={size} className={cls} weight="duotone" aria-hidden />
      );
    case "calendar":
      return (
        <CalendarBlank
          size={size}
          className={cls}
          weight="duotone"
          aria-hidden
        />
      );
    case "follow_up":
      return (
        <ClockClockwise
          size={size}
          className={cls}
          weight="duotone"
          aria-hidden
        />
      );
    default: {
      const et = normalizeEntityType(entityType);
      if (et === "move")
        return (
          <Truck size={size} className={cls} weight="duotone" aria-hidden />
        );
      if (et === "delivery")
        return (
          <Truck size={size} className={cls} weight="duotone" aria-hidden />
        );
      if (et === "invoice")
        return (
          <CurrencyDollar
            size={size}
            className={cls}
            weight="duotone"
            aria-hidden
          />
        );
      if (et === "quote")
        return (
          <ChatText size={size} className={cls} weight="duotone" aria-hidden />
        );
      return (
        <ListBullets size={size} className={cls} weight="duotone" aria-hidden />
      );
    }
  }
}

function matchesDatePreset(
  createdAt: string,
  preset: (typeof DATE_PRESETS)[number]["key"],
): boolean {
  if (preset === "all") return true;
  const t = new Date(createdAt).getTime();
  const now = Date.now();
  const ms = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  }[preset];
  return now - t <= ms;
}

export default function AuditLogClient({
  events,
}: {
  events: ActivityEventRow[];
}) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [datePreset, setDatePreset] =
    useState<(typeof DATE_PRESETS)[number]["key"]>("all");

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (!matchesDatePreset(e.created_at, datePreset)) return false;
      const et = normalizeEntityType(e.entity_type);
      if (typeFilter === "all") return true;
      if (typeFilter === "system") return !isKnownEntityType(et);
      return et === typeFilter;
    });
  }, [events, typeFilter, datePreset]);

  const columns: ColumnDef<ActivityEventRow>[] = useMemo(
    () => [
      {
        id: "time",
        label: "Time",
        accessor: (e) => new Date(e.created_at).getTime(),
        sortable: true,
        searchable: false,
        minWidth: "140px",
        defaultWidth: 140,
        exportAccessor: (e) => new Date(e.created_at).toISOString(),
        render: (e) => (
          <div className="flex items-start gap-2">
            <EventGlyph icon={e.icon} entityType={e.entity_type} />
            <span
              className="t-num text-[11px] font-medium text-[var(--tx2)] cursor-default"
              title={new Date(e.created_at).toLocaleString()}
            >
              {formatActivityTime(e.created_at)}
            </span>
          </div>
        ),
      },
      {
        id: "entity",
        label: "Entity",
        accessor: (e) => entityBadgeLabel(e.entity_type),
        sortable: true,
        searchable: true,
        minWidth: "110px",
        defaultWidth: 110,
        render: (e) => (
          <span className="inline-flex items-center rounded-lg border border-[var(--brd)] bg-[var(--bg)]/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--tx2)]">
            {entityBadgeLabel(e.entity_type)}
          </span>
        ),
      },
      {
        id: "event",
        label: "Event",
        accessor: (e) => humanizeEventType(e.event_type),
        sortable: true,
        searchable: true,
        minWidth: "160px",
        defaultWidth: 160,
        render: (e) => (
          <span className="text-[11px] font-semibold text-[var(--tx)] leading-snug">
            {humanizeEventType(e.event_type)}
          </span>
        ),
      },
      {
        id: "description",
        label: "Description",
        accessor: (e) =>
          formatActivityDescription(e.description || e.event_type) ?? "",
        sortable: false,
        searchable: true,
        minWidth: "240px",
        render: (e) => (
          <p className="text-[12px] text-[var(--tx2)] leading-snug line-clamp-3">
            {formatActivityDescription(e.description || e.event_type)}
          </p>
        ),
      },
      {
        id: "entity_id",
        label: "Entity ID",
        accessor: (e) => e.entity_id ?? "",
        sortable: false,
        searchable: true,
        alwaysHidden: true,
      },
      {
        id: "link",
        label: "Link",
        accessor: () => "",
        sortable: false,
        searchable: false,
        align: "right",
        minWidth: "90px",
        defaultWidth: 90,
        render: (e) => {
          const href = getEntityHref(e);
          if (!href) return null;
          return (
            <Link
              href={href}
              onClick={(ev) => ev.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--gold)] hover:underline"
            >
              Open
              <ArrowSquareOut size={14} weight="bold" aria-hidden />
            </Link>
          );
        },
      },
    ],
    [],
  );

  const emptyMessage =
    events.length === 0
      ? "No events recorded yet"
      : "No events match your filters";
  const emptySubtext =
    events.length === 0
      ? "New moves, deliveries, invoices and quotes will appear here as they happen."
      : "Try clearing search or widening the time range.";

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-5 md:px-6 py-4 sm:py-5 md:py-6 animate-fade-up min-w-0">
      <div className="mb-5">
        <BackButton label="Back" fallback="/admin/settings" />
      </div>

      <div className="mb-6">
        <p className="t-label text-[var(--tx3)]/88 mb-1.5">Operations</p>
        <h1 className="admin-page-hero text-[var(--tx)]">Audit log</h1>
        <p className="text-[12px] text-[var(--tx3)] mt-2 font-medium leading-snug max-w-xl">
          Status and activity events across moves, deliveries, billing, and
          quotes. Showing the latest 200 entries.
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          <span className="t-label text-[var(--tx3)] mr-0.5">When</span>
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

      <DataTable<ActivityEventRow>
        data={filtered}
        columns={columns}
        keyField="id"
        tableId="audit-log"
        defaultSortCol="time"
        defaultSortDir="desc"
        searchable
        searchPlaceholder="Search description, type, entity id…"
        pagination
        defaultPerPage={50}
        exportable
        exportFilename="yugo-audit-log"
        columnToggle
        stickyHeader
        striped
        emptyMessage={emptyMessage}
        emptySubtext={emptySubtext}
        mobileCardLayout={{
          primaryColumnId: "event",
          subtitleColumnId: "description",
          metaColumnIds: ["time", "entity"],
        }}
      />

      <div className="mt-3 flex items-center justify-end">
        <Link
          href="/admin/activity"
          className="text-[11px] font-semibold text-[var(--gold)] hover:underline"
        >
          Live activity feed
        </Link>
      </div>
    </div>
  );
}
