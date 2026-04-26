"use client"

import { useMemo, useState, useCallback } from "react"
import Link from "next/link"
import { ArrowSquareOut } from "@phosphor-icons/react";
import { PageHeader } from "@/design-system/admin/layout"
import { csvField } from "@/lib/admin-csv-field"
import {
  DataTable,
  type ColumnDef,
  type ColumnSort,
  type ViewMode,
} from "@/design-system/admin/table"
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
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ColumnSort | null>({
    columnId: "time",
    direction: "desc",
  });
  const [viewMode, setViewMode] = useState<ViewMode>("list");

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
        shortLabel: "Time",
        header: "Time",
        accessor: (e) => new Date(e.created_at).getTime(),
        sortable: true,
        width: 150,
        cell: (e) => (
          <span
            className="t-num text-[11px] font-medium text-[var(--yu3-ink-muted)] cursor-default tabular-nums"
            title={new Date(e.created_at).toLocaleString()}
          >
            {formatActivityTime(e.created_at)}
          </span>
        ),
      },
      {
        id: "entity",
        shortLabel: "Entity",
        header: "Entity",
        accessor: (e) => entityBadgeLabel(e.entity_type),
        sortable: true,
        width: 120,
        cell: (e) => (
          <span className="inline-flex items-center rounded-lg border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface-sunken)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--yu3-ink-muted)]">
            {entityBadgeLabel(e.entity_type)}
          </span>
        ),
      },
      {
        id: "event",
        shortLabel: "Event",
        header: "Event",
        accessor: (e) => humanizeEventType(e.event_type),
        sortable: true,
        width: 150,
        cell: (e) => (
          <span className="text-[11px] font-semibold text-[var(--yu3-ink)] leading-snug">
            {humanizeEventType(e.event_type)}
          </span>
        ),
      },
      {
        id: "description",
        shortLabel: "Description",
        header: "Description",
        accessor: (e) => {
          const base =
            formatActivityDescription(e.description || e.event_type) ?? "";
          return `${base} ${e.entity_id ?? ""}`.trim();
        },
        sortable: false,
        minWidth: 200,
        cell: (e) => (
          <p className="text-[12px] text-[var(--yu3-ink-muted)] leading-snug line-clamp-3 min-w-0">
            {formatActivityDescription(e.description || e.event_type)}
          </p>
        ),
      },
      {
        id: "link",
        shortLabel: "Open",
        header: "Link",
        accessor: () => "",
        sortable: false,
        align: "right",
        width: 100,
        cell: (e) => {
          const href = getEntityHref(e);
          if (!href) return null;
          return (
            <Link
              href={href}
              onClick={(ev) => ev.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--yu3-wine)] hover:underline"
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

  const onExport = useCallback(() => {
    const headers = [
      "Time (ISO)",
      "Entity",
      "Event",
      "Description",
      "Entity ID",
    ];
    const lines = filtered.map((e) => {
      const desc =
        formatActivityDescription(e.description || e.event_type) ?? "";
      return [
        new Date(e.created_at).toISOString(),
        entityBadgeLabel(e.entity_type),
        humanizeEventType(e.event_type),
        desc,
        e.entity_id ?? "",
      ]
        .map((c) => csvField(String(c)))
        .join(",");
    });
    const csv = [headers.map(csvField).join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "yugo-audit-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  const emptyMessage =
    events.length === 0
      ? "No events recorded yet"
      : "No events match your filters";
  const emptySubtext =
    events.length === 0
      ? "New moves, deliveries, invoices and quotes will appear here as they happen."
      : "Try clearing search or widening the time range.";

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <PageHeader
        eyebrow="Operations"
        title="Audit log"
        description="Status and activity events across moves, deliveries, billing, and quotes. Showing the latest 200 entries."
      />

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
        columns={columns}
        rows={filtered}
        rowId={(e) => e.id}
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        onExport={onExport}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        availableViews={["list"]}
        searchPlaceholder="Search description, type, entity id…"
        emptyState={
          <div className="px-4 py-8 text-center max-w-md mx-auto">
            <p className="text-[15px] font-semibold text-[var(--yu3-ink)] mb-1">
              {emptyMessage}
            </p>
            <p className="text-[12px] text-[var(--yu3-ink-muted)]">{emptySubtext}</p>
          </div>
        }
      />

      <div className="mt-3 flex items-center justify-end">
        <Link
          href="/admin/activity"
          className="text-[11px] font-semibold text-[var(--yu3-wine)] hover:underline"
        >
          Live activity feed
        </Link>
      </div>
    </div>
  );
}
