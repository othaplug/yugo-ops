"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  LEAD_PRIORITY_LABELS,
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
} from "@/lib/leads/admin-labels"
import {
  PageHeader,
  PageMetaDivider,
} from "@/design-system/admin/layout/PageHeader"
import {
  Button,
  Badge,
  StatusPill,
  TrendPill,
  Sparkline,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardEyebrow,
  Avatar,
  EmptyState,
  Section,
} from "@/design-system/admin/primitives"
import {
  DataTable,
  type ColumnDef,
  type ColumnSort,
  type ViewMode,
  type BulkAction,
  type RowAction,
} from "@/design-system/admin/table"
import {
  Plus,
  Phone,
  Envelope,
  CheckCircle,
  WarningCircle,
  XCircle,
  Clock,
  Funnel,
  ArrowRight,
  Sparkle,
  FileText,
  User,
} from "@/design-system/admin/icons"
import { useToast } from "../components/Toast"
import { LeadsNavTabs } from "./LeadsNavTabs"

export type LeadRow = {
  id: string
  lead_number: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  source: string
  source_detail: string | null
  service_type: string | null
  detected_service_type?: string | null
  move_size: string | null
  preferred_date: string | null
  from_address: string | null
  to_address: string | null
  status: string
  priority: string
  created_at: string
  first_response_at: string | null
  response_sla_target_at?: string | null
  quote_uuid: string | null
  completeness_path?: string | null
  completeness_score?: number | null
  recommended_tier?: string | null
  intelligence_summary?: string | null
  parsed_inventory?: unknown
  follow_up_sent_at?: string | null
  fields_missing?: unknown
  clarifications_needed?: unknown
  detected_dates?: unknown
  estimated_value?: number | null
  requires_specialty_quote?: boolean | null
  parsed_weight_lbs_max?: number | null
}

type Metrics = {
  todayByStatus: Record<string, number>
  avgResponseMin: number | null
  pctUnder5min: number | null
  pctUnder15min: number | null
  pctOver1hr: number | null
  funnel: {
    received: number
    contacted: number
    quote_sent: number
    converted: number
    lost: number
    stale: number
  }
  bySource: Record<
    string,
    { count: number; converted: number; valueSum: number }
  >
  speedVsConversion: {
    label: string
    leads: number
    converted: number
    rate: number
  }[]
  recentActivity: {
    id: string
    activity_type: string
    notes: string | null
    created_at: string
    lead_id: string
    lead_number: string | null
    lead_name: string
  }[]
}

function fullName(lead: LeadRow) {
  return [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown"
}

function sourceLabel(source: string, detail: string | null | undefined) {
  const d = (detail || "").trim()
  if (d) return d
  return LEAD_SOURCE_LABELS[source] || source.replace(/_/g, " ")
}

function elapsedLabel(createdAt: string, now: number) {
  const sec = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`
  return `${m}:${String(s).padStart(2, "0")}`
}

function elapsedTone(createdAt: string, now: number): "success" | "warning" | "danger" | "neutral" {
  const sec = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000))
  if (sec <= 300) return "success"
  if (sec <= 900) return "warning"
  if (sec <= 3600) return "danger"
  return "neutral"
}

function statusTone(status: string): Parameters<typeof StatusPill>[0]["tone"] {
  switch (status) {
    case "new":
      return "new"
    case "assigned":
    case "follow_up_sent":
    case "awaiting_reply":
      return "info"
    case "contacted":
      return "info"
    case "quote_sent":
      return "wine"
    case "converted":
      return "success"
    case "lost":
      return "danger"
    case "stale":
      return "warning"
    default:
      return "neutral"
  }
}

function priorityTone(
  priority: string,
): Parameters<typeof StatusPill>[0]["tone"] {
  if (priority === "urgent") return "danger"
  if (priority === "high") return "warning"
  if (priority === "low") return "neutral"
  return "info"
}

function ElapsedCell({ createdAt }: { createdAt: string }) {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const tone = elapsedTone(createdAt, now)
  return (
    <span
      className="yu3-num text-[12px] font-semibold inline-flex items-center gap-1"
      style={{
        color:
          tone === "success"
            ? "var(--yu3-success)"
            : tone === "warning"
              ? "var(--yu3-warning)"
              : tone === "danger"
                ? "var(--yu3-danger)"
                : "var(--yu3-ink-muted)",
      }}
    >
      <Clock size={11} />
      {elapsedLabel(createdAt, now)}
    </span>
  )
}

const STAGES: { id: string; label: string; tone: "neutral" | "info" | "wine" | "success" | "danger" | "warning" }[] = [
  { id: "new", label: "New", tone: "info" },
  { id: "contacted", label: "Contacted", tone: "info" },
  { id: "quote_sent", label: "Quote sent", tone: "wine" },
  { id: "converted", label: "Converted", tone: "success" },
  { id: "lost", label: "Lost", tone: "danger" },
]

function toStage(row: LeadRow): string {
  const s = row.status
  if (["assigned", "follow_up_sent", "awaiting_reply", "new"].includes(s))
    return "new"
  if (["contacted"].includes(s)) return "contacted"
  if (["quote_sent", "viewed"].includes(s)) return "quote_sent"
  if (["converted"].includes(s)) return "converted"
  if (["lost", "stale"].includes(s)) return "lost"
  return "new"
}

/* ══════════════════════════════════════════════════════════════════════ */

export default function LeadsHubV3Client({
  mode,
}: {
  mode: "dashboard" | "all" | "mine"
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [metrics, setMetrics] = React.useState<Metrics | null>(null)
  const [attention, setAttention] = React.useState<LeadRow[]>([])
  const [list, setList] = React.useState<LeadRow[]>([])
  const [loadErr, setLoadErr] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  const [search, setSearch] = React.useState("")
  const [sort, setSort] = React.useState<ColumnSort | null>({
    columnId: "created_at",
    direction: "desc",
  })
  const [viewMode, setViewMode] = React.useState<ViewMode>("list")
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())

  const refresh = React.useCallback(async () => {
    setLoadErr(null)
    setLoading(true)
    try {
      const [mRes, aRes, lRes] = await Promise.all([
        mode === "dashboard"
          ? fetch("/api/admin/leads/metrics")
          : Promise.resolve(null as Response | null),
        mode === "dashboard"
          ? fetch("/api/admin/leads?attention=1&limit=50")
          : Promise.resolve(null as Response | null),
        mode !== "dashboard"
          ? fetch(
              mode === "mine"
                ? "/api/admin/leads?mine=1&limit=300"
                : "/api/admin/leads?limit=300",
            )
          : Promise.resolve(null as Response | null),
      ])
      if (mRes) {
        const mj = await mRes.json()
        if (!mRes.ok) throw new Error(mj.error || "Metrics failed")
        setMetrics(mj)
      }
      if (aRes) {
        const aj = await aRes.json()
        if (!aRes.ok) throw new Error(aj.error || "Leads failed")
        setAttention((aj.leads || []) as LeadRow[])
      }
      if (lRes) {
        const lj = await lRes.json()
        if (!lRes.ok) throw new Error(lj.error || "Leads failed")
        setList((lj.leads || []) as LeadRow[])
      }
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [mode])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  React.useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("leads-realtime-v3")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => {
          refresh()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  /* ── Columns ──────────────────────────────────────────────────────── */
  const columns = React.useMemo<ColumnDef<LeadRow>[]>(
    () => [
      {
        id: "name",
        header: "Lead",
        shortLabel: "Lead",
        sticky: true,
        minWidth: 240,
        required: true,
        sortable: true,
        accessor: (r) => `${fullName(r)} ${r.lead_number}`,
        cell: (r) => (
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={fullName(r)} size={24} />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-[var(--yu3-ink-strong)] truncate">
                {fullName(r)}
              </div>
              <div className="text-[11px] text-[var(--yu3-ink-muted)] truncate">
                {r.lead_number}
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        shortLabel: "Status",
        width: 140,
        filterable: true,
        sortable: true,
        accessor: (r) => r.status,
        cell: (r) => (
          <StatusPill tone={statusTone(r.status)} dot>
            {LEAD_STATUS_LABELS[r.status] || r.status.replace(/_/g, " ")}
          </StatusPill>
        ),
      },
      {
        id: "source",
        header: "Source",
        shortLabel: "Source",
        width: 180,
        filterable: true,
        sortable: true,
        accessor: (r) => r.source,
        cell: (r) => (
          <span className="text-[12px] text-[var(--yu3-ink)] truncate">
            {sourceLabel(r.source, r.source_detail)}
          </span>
        ),
      },
      {
        id: "priority",
        header: "Priority",
        shortLabel: "Priority",
        width: 110,
        sortable: true,
        accessor: (r) => r.priority,
        cell: (r) => (
          <StatusPill tone={priorityTone(r.priority)}>
            {LEAD_PRIORITY_LABELS[r.priority] || r.priority}
          </StatusPill>
        ),
      },
      {
        id: "elapsed",
        header: "Response",
        shortLabel: "Response",
        width: 120,
        sortable: true,
        accessor: (r) =>
          r.first_response_at
            ? Date.parse(r.first_response_at) - Date.parse(r.created_at)
            : Date.now() - Date.parse(r.created_at),
        cell: (r) => <ElapsedCell createdAt={r.created_at} />,
      },
      {
        id: "estimated_value",
        header: "Est. value",
        shortLabel: "Value",
        width: 120,
        align: "right",
        sortable: true,
        numeric: true,
        accessor: (r) => r.estimated_value ?? 0,
        cell: (r) =>
          r.estimated_value ? (
            <span className="yu3-num text-[13px] font-semibold">
              ${Math.round(r.estimated_value).toLocaleString()}
            </span>
          ) : (
            <span className="text-[var(--yu3-ink-faint)]">—</span>
          ),
      },
      {
        id: "move_size",
        header: "Move size",
        shortLabel: "Size",
        width: 120,
        sortable: true,
        accessor: (r) => r.move_size,
        cell: (r) => (
          <span className="text-[12px]">{r.move_size || ""}</span>
        ),
      },
      {
        id: "preferred_date",
        header: "Preferred",
        shortLabel: "Date",
        width: 120,
        sortable: true,
        accessor: (r) => r.preferred_date,
        cell: (r) =>
          r.preferred_date ? (
            <span className="yu3-num text-[12px]">
              {new Date(r.preferred_date).toLocaleDateString()}
            </span>
          ) : (
            <span className="text-[var(--yu3-ink-faint)]">—</span>
          ),
        hiddenByDefault: false,
      },
      {
        id: "phone",
        header: "Phone",
        shortLabel: "Phone",
        width: 140,
        sortable: false,
        accessor: (r) => r.phone,
        cell: (r) =>
          r.phone ? (
            <a
              href={`tel:${r.phone}`}
              className="inline-flex items-center gap-1 text-[12px] text-[var(--yu3-ink)] hover:text-[var(--yu3-ink-strong)]"
              onClick={(e) => e.stopPropagation()}
            >
              <Phone size={11} /> {r.phone}
            </a>
          ) : (
            <span className="text-[var(--yu3-ink-faint)]">—</span>
          ),
        hiddenByDefault: true,
      },
      {
        id: "email",
        header: "Email",
        shortLabel: "Email",
        minWidth: 200,
        sortable: false,
        accessor: (r) => r.email,
        cell: (r) =>
          r.email ? (
            <a
              href={`mailto:${r.email}`}
              className="inline-flex items-center gap-1 text-[12px] text-[var(--yu3-ink)] hover:text-[var(--yu3-ink-strong)] truncate"
              onClick={(e) => e.stopPropagation()}
            >
              <Envelope size={11} /> {r.email}
            </a>
          ) : (
            <span className="text-[var(--yu3-ink-faint)]">—</span>
          ),
        hiddenByDefault: true,
      },
      {
        id: "created_at",
        header: "Created",
        shortLabel: "Created",
        width: 120,
        sortable: true,
        accessor: (r) => Date.parse(r.created_at),
        cell: (r) => (
          <span className="yu3-num text-[12px] text-[var(--yu3-ink-muted)]">
            {new Date(r.created_at).toLocaleDateString()}
          </span>
        ),
      },
    ],
    [],
  )

  const bulkActions = React.useMemo<BulkAction<LeadRow>[]>(
    () => [
      {
        id: "assign",
        label: "Assign",
        icon: <User size={13} />,
        run: (rows) => {
          toast(`Assign flow for ${rows.length} leads (coming soon)`, "check")
        },
      },
      {
        id: "quote",
        label: "Create quote",
        icon: <FileText size={13} />,
        run: (rows) => {
          if (rows.length === 1 && rows[0]) {
            router.push(
              `/admin/quotes/new?lead_id=${encodeURIComponent(rows[0].id)}`,
            )
          } else {
            toast(`Batch quote not yet supported`, "x")
          }
        },
      },
      {
        id: "mark_contacted",
        label: "Mark contacted",
        icon: <CheckCircle size={13} />,
        run: async (rows) => {
          try {
            await Promise.all(
              rows.map((r) =>
                fetch(`/api/admin/leads/${r.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "contacted" }),
                }),
              ),
            )
            toast(`Marked ${rows.length} leads as contacted`, "check")
            refresh()
          } catch {
            toast(`Failed to update`, "x")
          }
        },
      },
      {
        id: "lost",
        label: "Mark lost",
        icon: <XCircle size={13} />,
        danger: true,
        run: async (rows) => {
          try {
            await Promise.all(
              rows.map((r) =>
                fetch(`/api/admin/leads/${r.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "lost" }),
                }),
              ),
            )
            toast(`Marked ${rows.length} leads as lost`, "check")
            refresh()
          } catch {
            toast(`Failed to update`, "x")
          }
        },
      },
    ],
    [router, toast, refresh],
  )

  const rowActions = React.useMemo<RowAction<LeadRow>[]>(
    () => [
      {
        id: "open",
        label: "Open details",
        icon: <ArrowRight size={13} />,
        run: (r) => router.push(`/admin/leads/${r.id}`),
      },
      {
        id: "quote",
        label: "Create quote",
        icon: <FileText size={13} />,
        run: (r) =>
          router.push(
            `/admin/quotes/new?lead_id=${encodeURIComponent(r.id)}`,
          ),
      },
    ],
    [router],
  )

  /* ── Page tabs ────────────────────────────────────────────────────── */
  const tabs = <LeadsNavTabs active={mode} />

  /* ══════════════════════════════════════════════════════════════════ */
  /* Dashboard mode                                                      */
  /* ══════════════════════════════════════════════════════════════════ */
  if (mode === "dashboard") {
    const funnel = metrics?.funnel || {
      received: 0,
      contacted: 0,
      quote_sent: 0,
      converted: 0,
      lost: 0,
      stale: 0,
    }
    const convRate =
      funnel.received > 0 ? (funnel.converted / funnel.received) * 100 : 0
    const avgMin = metrics?.avgResponseMin ?? null
    const pctSub5 = metrics?.pctUnder5min ?? null

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="Leads"
          title="Speed to lead"
          description="Front-line pipeline for inbound inquiries. Answer fast, convert more."
          meta={
            <>
              <span>Last refreshed just now</span>
              <PageMetaDivider />
              <span>Realtime</span>
            </>
          }
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<Funnel size={13} />}
              >
                Filters
              </Button>
              <Button
                variant="primary"
                size="sm"
                leadingIcon={<Plus size={13} />}
                onClick={() => router.push("/admin/leads/all")}
              >
                New lead
              </Button>
            </>
          }
          tabs={tabs}
        />

        {loadErr ? (
          <Card>
            <CardBody>
              <div className="text-[13px] text-[var(--yu3-danger)]">
                {loadErr}
              </div>
            </CardBody>
          </Card>
        ) : null}

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            eyebrow="Received"
            value={String(funnel.received)}
            helper="Total inbound"
          />
          <KpiCard
            eyebrow="Conversion"
            value={`${convRate.toFixed(1)}%`}
            helper={`${funnel.converted} won`}
            trend={convRate > 10 ? convRate : undefined}
          />
          <KpiCard
            eyebrow="Avg response"
            value={avgMin != null ? `${Math.round(avgMin)}m` : "0m"}
            helper="First touch"
          />
          <KpiCard
            eyebrow="Under 5m"
            value={pctSub5 != null ? `${Math.round(pctSub5)}%` : "0%"}
            helper="Speed wins"
            trend={pctSub5 ?? undefined}
          />
        </div>

        {/* Funnel + recent activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div>
                <CardEyebrow>Funnel</CardEyebrow>
                <CardTitle>Today by stage</CardTitle>
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-5 gap-2">
                {([
                  { k: "received", label: "Received" },
                  { k: "contacted", label: "Contacted" },
                  { k: "quote_sent", label: "Quote sent" },
                  { k: "converted", label: "Converted" },
                  { k: "lost", label: "Lost" },
                ] as const).map(({ k, label }, i) => {
                  const v = funnel[k] as number
                  const max = Math.max(
                    funnel.received,
                    funnel.contacted,
                    funnel.quote_sent,
                    funnel.converted,
                    funnel.lost,
                    1,
                  )
                  const h = Math.max(6, (v / max) * 120)
                  return (
                    <div key={k} className="flex flex-col items-center gap-2">
                      <div className="flex items-end h-[130px]">
                        <div
                          className="w-10 rounded-t-[var(--yu3-r-sm)]"
                          style={{
                            height: h,
                            background: `var(--yu3-c${(i % 6) + 1})`,
                          }}
                        />
                      </div>
                      <div className="yu3-num text-[14px] font-semibold text-[var(--yu3-ink-strong)]">
                        {v}
                      </div>
                      <div className="yu3-t-eyebrow text-center">{label}</div>
                    </div>
                  )
                })}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardEyebrow>Recent activity</CardEyebrow>
                <CardTitle>Last updates</CardTitle>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <ul className="divide-y divide-[var(--yu3-line-subtle)]">
                {(metrics?.recentActivity ?? []).slice(0, 8).map((act) => (
                  <li key={act.id} className="px-5 py-3">
                    <Link
                      href={`/admin/leads/${act.lead_id}`}
                      className="flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium text-[var(--yu3-ink-strong)] truncate">
                          {act.lead_name}{" "}
                          <span className="text-[var(--yu3-ink-faint)] yu3-num">
                            {act.lead_number || ""}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--yu3-ink-muted)] truncate">
                          {act.activity_type.replace(/_/g, " ")}
                          {act.notes ? ` · ${act.notes}` : ""}
                        </div>
                      </div>
                      <div className="yu3-num text-[11px] text-[var(--yu3-ink-faint)] shrink-0">
                        {new Date(act.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </Link>
                  </li>
                ))}
                {(!metrics || metrics.recentActivity.length === 0) && (
                  <li className="px-5 py-8 text-center text-[12px] text-[var(--yu3-ink-muted)]">
                    No activity yet.
                  </li>
                )}
              </ul>
            </CardBody>
          </Card>
        </div>

        {/* Attention */}
        <Section
          eyebrow="Needs attention"
          title="Leads requiring follow-up"
          actions={
            <Button
              variant="ghost"
              size="sm"
              asChild
              trailingIcon={<ArrowRight size={12} />}
            >
              <Link href="/admin/leads/all">View all</Link>
            </Button>
          }
        >
          {attention.length === 0 ? (
            <EmptyState
              title="You're caught up"
              description="No leads currently need attention. Nice work."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {attention.slice(0, 6).map((lead) => (
                <AttentionCard
                  key={lead.id}
                  lead={lead}
                  onOpen={() => router.push(`/admin/leads/${lead.id}`)}
                />
              ))}
            </div>
          )}
        </Section>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════════════════ */
  /* List / Pipeline mode                                                */
  /* ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Leads"
        title={mode === "mine" ? "My leads" : "All leads"}
        description="Track inbound, qualify fast, move them to quote."
        meta={
          <>
            <span className="yu3-num">{list.length}</span>
            <span>records</span>
            {selectedIds.size > 0 ? (
              <>
                <PageMetaDivider />
                <span>
                  <span className="yu3-num">{selectedIds.size}</span> selected
                </span>
              </>
            ) : null}
          </>
        }
        actions={
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Plus size={13} />}
            onClick={() => router.push("/admin/leads/new")}
          >
            New lead
          </Button>
        }
        tabs={tabs}
      />

      {loadErr ? (
        <div className="text-[13px] text-[var(--yu3-danger)] mb-2">
          {loadErr}
        </div>
      ) : null}

      <DataTable<LeadRow>
        columns={columns}
        rows={list}
        rowId={(r) => r.id}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search leads by name, email, number…"
        sort={sort}
        onSortChange={setSort}
        selectedRowIds={selectedIds}
        onSelectedRowIdsChange={setSelectedIds}
        bulkActions={bulkActions}
        rowActions={rowActions}
        onRowClick={(r) => router.push(`/admin/leads/${r.id}`)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        availableViews={["list", "pipeline"]}
        pipeline={{
          stages: STAGES,
          stageForRow: toStage,
          renderCard: (row) => <LeadMiniCard lead={row} />,
        }}
        onExport={() => toast("Export coming soon", "check")}
        onNewRecord={() => router.push("/admin/leads/new")}
      />
    </div>
  )
}

/* ─── KPI card used on dashboard mode ──────────────────────────────── */
function KpiCard({
  eyebrow,
  value,
  helper,
  trend,
  spark,
}: {
  eyebrow: string
  value: string
  helper?: string
  trend?: number
  spark?: number[]
}) {
  return (
    <Card>
      <CardBody className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="yu3-t-eyebrow">{eyebrow}</div>
            <div className="yu3-t-metric mt-1 truncate">{value}</div>
            {helper ? (
              <div className="yu3-t-mini mt-1 truncate">{helper}</div>
            ) : null}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            {typeof trend === "number" ? <TrendPill delta={trend} /> : null}
            {spark && spark.length > 1 ? (
              <Sparkline values={spark} width={80} height={28} />
            ) : null}
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

/* ─── Attention card ───────────────────────────────────────────────── */
function AttentionCard({
  lead,
  onOpen,
}: {
  lead: LeadRow
  onOpen: () => void
}) {
  const name = fullName(lead)
  const p = lead.completeness_path || "manual_review"
  const Icon =
    p === "auto_quote"
      ? CheckCircle
      : p === "needs_info"
        ? WarningCircle
        : XCircle
  const iconColor =
    p === "auto_quote"
      ? "var(--yu3-success)"
      : p === "needs_info"
        ? "var(--yu3-warning)"
        : "var(--yu3-danger)"
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line-subtle)] rounded-[var(--yu3-r-lg)] p-4 hover:border-[var(--yu3-line-strong)] hover:shadow-[var(--yu3-shadow-sm)] transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ color: iconColor }}>
            <Icon size={14} weight="fill" />
          </span>
          <ElapsedCell createdAt={lead.created_at} />
        </div>
        <StatusPill tone={statusTone(lead.status)}>
          {LEAD_STATUS_LABELS[lead.status] || lead.status.replace(/_/g, " ")}
        </StatusPill>
      </div>
      <div className="mt-2 text-[14px] font-semibold text-[var(--yu3-ink-strong)] truncate">
        {name}
      </div>
      <div className="yu3-num text-[11px] text-[var(--yu3-ink-faint)]">
        {lead.lead_number}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-[var(--yu3-ink-muted)]">
        <div>
          <div className="yu3-t-eyebrow">Size</div>
          <div className="yu3-num text-[var(--yu3-ink)]">
            {lead.move_size || ""}
          </div>
        </div>
        <div>
          <div className="yu3-t-eyebrow">Preferred</div>
          <div className="yu3-num text-[var(--yu3-ink)]">
            {lead.preferred_date
              ? new Date(lead.preferred_date).toLocaleDateString()
              : ""}
          </div>
        </div>
      </div>
      {lead.intelligence_summary ? (
        <p className="mt-3 text-[11px] text-[var(--yu3-ink-muted)] line-clamp-2 flex items-start gap-1">
          <Sparkle size={11} className="text-[var(--yu3-wine)] mt-0.5 shrink-0" />
          {lead.intelligence_summary}
        </p>
      ) : null}
    </button>
  )
}

/* ─── Lead mini card for pipeline view ─────────────────────────────── */
function LeadMiniCard({ lead }: { lead: LeadRow }) {
  return (
    <div className="bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line-subtle)] rounded-[var(--yu3-r-md)] p-3 hover:border-[var(--yu3-line-strong)] transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar name={fullName(lead)} size={20} />
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-[var(--yu3-ink-strong)] truncate">
              {fullName(lead)}
            </div>
            <div className="yu3-num text-[10px] text-[var(--yu3-ink-faint)]">
              {lead.lead_number}
            </div>
          </div>
        </div>
        <ElapsedCell createdAt={lead.created_at} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-[var(--yu3-ink-muted)] truncate">
          {sourceLabel(lead.source, lead.source_detail)}
        </span>
        {lead.estimated_value ? (
          <Badge variant="wine" size="sm">
            ${Math.round(lead.estimated_value).toLocaleString()}
          </Badge>
        ) : null}
      </div>
    </div>
  )
}
