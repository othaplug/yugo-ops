"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { formatAdminCreatedAt } from "@/lib/date-format"
import { organizationTypeLabel } from "@/lib/partner-type"

import { PageHeader } from "@/design-system/admin/layout"
import {
  Button,
  StatusPill,
  Avatar,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/design-system/admin/primitives"
import {
  DataTable,
  type ColumnDef,
  type ColumnSort,
  type RowAction,
} from "@/design-system/admin/table"
import { KpiStrip } from "@/design-system/admin/dashboard"
import { Sparkline } from "@/design-system/admin/primitives"
import { Plus, Pulse } from "@phosphor-icons/react"

const ACTIVITY_WEEKS = 12
const emptyActivitySeries = () => new Array(ACTIVITY_WEEKS).fill(0)

interface Partner {
  id: string
  name: string
  type: string
  contact_name: string | null
  email: string | null
  phone: string | null
  status: string
  created_at: string
  /** Last 12 weeks, oldest first: combined moves + deliveries per week. */
  activity_weekly?: number[]
}

interface RealtorRow {
  id: string
  agent_name: string
  email: string | null
  brokerage: string | null
  referral_count: number
  created_at: string
}

const TAB_KEYS = [
  "all",
  "furniture_retailer",
  "interior_designer",
  "hospitality",
  "art_gallery",
  "property_management",
  "developer_portfolio",
  "referral",
] as const

const TAB_LABELS: Record<string, string> = {
  all: "All",
  furniture_retailer: "Retail",
  interior_designer: "Designers",
  hospitality: "Hospitality",
  art_gallery: "Gallery",
  property_management: "Property Mgmt",
  developer_portfolio: "Developers",
  referral: "Referral",
}

const TAB_TYPE_MAP: Record<string, string[]> = {
  furniture_retailer: [
    "furniture_retailer",
    "retail",
    "cabinetry",
    "flooring",
    "appliances",
  ],
  interior_designer: ["interior_designer", "designer", "av_technology"],
  hospitality: ["hospitality", "medical_equipment"],
  art_gallery: ["art_gallery", "antique_dealer", "gallery"],
  property_management: [
    "property_management_residential",
    "property_management_commercial",
  ],
  developer_portfolio: ["developer_builder"],
  referral: ["realtor", "property_manager", "developer"],
}

function partnerStatusTone(
  s: string,
): React.ComponentProps<typeof StatusPill>["tone"] {
  const k = (s || "active").toLowerCase()
  if (k === "active") return "success"
  if (k.includes("pending")) return "warning"
  if (k === "suspended") return "danger"
  return "neutral"
}

export default function PartnersV3Client() {
  const router = useRouter()
  const [partners, setPartners] = React.useState<Partner[]>([])
  const [realtors, setRealtors] = React.useState<RealtorRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState<string>("all")
  const [search, setSearch] = React.useState("")
  const [sort, setSort] = React.useState<ColumnSort | null>({
    columnId: "created_at",
    direction: "desc",
  })
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [healthStats, setHealthStats] = React.useState<{
    at_risk: number
    cold: number
  } | null>(null)

  React.useEffect(() => {
    fetch("/api/admin/partners/health")
      .then((r) => r.json())
      .then((d) => {
        if (d.stats)
          setHealthStats({ at_risk: d.stats.at_risk, cold: d.stats.cold })
      })
      .catch(() => null)
  }, [])

  React.useEffect(() => {
    ;(async () => {
      try {
        const [pRes, rRes] = await Promise.all([
          fetch("/api/admin/partners/list"),
          fetch("/api/admin/realtors-list"),
        ])
        const pJson = await pRes.json().catch(() => ({}))
        const rJson = await rRes.json().catch(() => ({}))
        setPartners(Array.isArray(pJson.partners) ? pJson.partners : [])
        setRealtors(Array.isArray(rJson.realtors) ? rJson.realtors : [])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filteredPartners = React.useMemo(() => {
    if (activeTab === "all") return partners
    const types = TAB_TYPE_MAP[activeTab]
    if (!types) return partners.filter((p) => p.type === activeTab)
    return partners.filter((p) => types.includes(p.type))
  }, [partners, activeTab])

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: partners.length, referral: realtors.length }
    for (const k of TAB_KEYS) {
      if (k === "all" || k === "referral") continue
      const types = TAB_TYPE_MAP[k]
      c[k] = types ? partners.filter((p) => types.includes(p.type)).length : 0
    }
    return c
  }, [partners, realtors.length])

  const kpis = React.useMemo(() => {
    const active = partners.filter((p) => (p.status || "active") === "active").length
    const recent = partners.filter((p) => {
      const d = new Date(p.created_at)
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 90)
      return d > cutoff
    }).length
    return [
      {
        id: "total",
        label: "Total partners",
        value: partners.length.toString(),
      },
      {
        id: "active",
        label: "Active",
        value: active.toString(),
      },
      {
        id: "recent",
        label: "Joined 90 days",
        value: recent.toString(),
      },
      {
        id: "attention",
        label: "Needs attention",
        value: healthStats
          ? String((healthStats.at_risk || 0) + (healthStats.cold || 0))
          : "0",
        hint: healthStats
          ? `${healthStats.at_risk} at risk · ${healthStats.cold} cold`
          : undefined,
      },
    ]
  }, [partners, healthStats])

  const partnerColumns = React.useMemo<ColumnDef<Partner>[]>(
    () => [
      {
        id: "name",
        header: "Company",
        accessor: (p) => p.name,
        sortable: true,
        searchable: true,
        width: 260,
        cell: (p) => (
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={p.name} size={28} />
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-[var(--yu3-ink-strong)] truncate">
                {p.name}
              </div>
              <div className="text-[11px] text-[var(--yu3-ink-muted)] truncate">
                {organizationTypeLabel(p.type) || p.type}
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "contact",
        header: "Contact",
        accessor: (p) => p.contact_name ?? "",
        searchable: true,
        width: 180,
        cell: (p) => (
          <div>
            <div className="text-[13px] text-[var(--yu3-ink)]">
              {p.contact_name || ""}
            </div>
            {p.email ? (
              <div className="text-[11px] text-[var(--yu3-ink-muted)] truncate">
                {p.email}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: "activity",
        header: "Activity",
        shortLabel: "Activity",
        align: "center",
        width: 120,
        minWidth: 96,
        sortable: true,
        numeric: true,
        accessor: (p) => {
          const s = p.activity_weekly
          if (!s?.length) return 0
          return s.reduce((a, b) => a + b, 0)
        },
        cell: (p) => {
          const series =
            p.activity_weekly && p.activity_weekly.length === ACTIVITY_WEEKS
              ? p.activity_weekly
              : emptyActivitySeries()
          const total = series.reduce((a, b) => a + b, 0)
          return (
            <div className="flex items-center justify-center py-0.5 min-w-0">
              <Sparkline
                values={series}
                width={88}
                height={28}
                strokeWidth={1.5}
                downStroke="var(--yu3-wine)"
                ariaLabel={
                  total === 0
                    ? "No recorded moves or deliveries in the last 12 weeks"
                    : `Work with Yugo in the last 12 weeks: ${total} moves and deliveries combined, by week (oldest to newest)`
                }
              />
            </div>
          )
        },
      },
      {
        id: "status",
        header: "Status",
        accessor: (p) => p.status,
        sortable: true,
        width: 120,
        cell: (p) => (
          <StatusPill tone={partnerStatusTone(p.status)}>
            {(p.status || "active").replace(/_/g, " ")}
          </StatusPill>
        ),
      },
      {
        id: "created_at",
        header: "Joined",
        accessor: (p) => p.created_at,
        sortable: true,
        width: 130,
        cell: (p) => (
          <span className="yu3-num text-[12px] text-[var(--yu3-ink-muted)]">
            {formatAdminCreatedAt(p.created_at)}
          </span>
        ),
      },
    ],
    [],
  )

  const realtorColumns = React.useMemo<ColumnDef<RealtorRow>[]>(
    () => [
      {
        id: "agent",
        header: "Agent",
        accessor: (r) => r.agent_name,
        sortable: true,
        searchable: true,
        width: 260,
        cell: (r) => (
          <div className="flex items-center gap-3">
            <Avatar name={r.agent_name} size={28} />
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-[var(--yu3-ink-strong)] truncate">
                {r.agent_name}
              </div>
              {r.brokerage ? (
                <div className="text-[11px] text-[var(--yu3-ink-muted)] truncate">
                  {r.brokerage}
                </div>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        id: "email",
        header: "Email",
        accessor: (r) => r.email ?? "",
        width: 200,
        cell: (r) => (
          <span className="text-[12px] text-[var(--yu3-ink)]">
            {r.email || ""}
          </span>
        ),
      },
      {
        id: "referrals",
        header: "Referrals",
        accessor: (r) => r.referral_count,
        align: "right",
        sortable: true,
        numeric: true,
        width: 120,
        cell: (r) => (
          <span className="yu3-num text-[13px] font-semibold text-[var(--yu3-ink-strong)]">
            {r.referral_count}
          </span>
        ),
      },
      {
        id: "created_at",
        header: "Joined",
        accessor: (r) => r.created_at,
        sortable: true,
        width: 130,
        cell: (r) => (
          <span className="yu3-num text-[12px] text-[var(--yu3-ink-muted)]">
            {formatAdminCreatedAt(r.created_at)}
          </span>
        ),
      },
    ],
    [],
  )

  const partnerActions = React.useMemo<RowAction<Partner>[]>(
    () => [
      {
        id: "open",
        label: "Open partner",
        run: (p) => router.push(`/admin/clients/${p.id}`),
      },
    ],
    [router],
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="CRM"
        title="Partners"
        description="Every B2B relationship — retail, designers, hospitality, gallery, and referral partners."
        actions={
          <>
            <Button
              variant="secondary"
              leadingIcon={<Pulse size={16} />}
              onClick={() => router.push("/admin/partners/health")}
            >
              Partner health
            </Button>
            <Button
              variant="primary"
              leadingIcon={<Plus size={16} />}
              onClick={() => router.push("/admin/partners/new")}
            >
              Add partner
            </Button>
          </>
        }
      />
      <KpiStrip tiles={kpis} columns={4} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {TAB_KEYS.map((k) => (
            <TabsTrigger key={k} value={k}>
              <span>{TAB_LABELS[k]}</span>
              <span className="ml-2 yu3-num text-[11px] text-[var(--yu3-ink-muted)]">
                {counts[k] ?? 0}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {activeTab === "referral" ? (
        <DataTable<RealtorRow>
          columns={realtorColumns}
          rows={realtors}
          rowId={(r) => r.id}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          sort={sort}
          onSortChange={setSort}
          onRowClick={(r) => router.push(`/admin/partners/realtors#${r.id}`)}
        />
      ) : (
        <DataTable<Partner>
          columns={partnerColumns}
          rows={filteredPartners}
          rowId={(p) => p.id}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          sort={sort}
          onSortChange={setSort}
          selectedRowIds={selectedIds}
          onSelectedRowIdsChange={setSelectedIds}
          rowActions={partnerActions}
          onRowClick={(p) => router.push(`/admin/clients/${p.id}`)}
        />
      )}
    </div>
  )
}
