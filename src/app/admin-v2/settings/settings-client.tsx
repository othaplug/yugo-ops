"use client"

import * as React from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/admin-v2/composites/PageHeader"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/admin-v2/primitives/Tabs"
import { Button } from "@/components/admin-v2/primitives/Button"
import { Chip } from "@/components/admin-v2/primitives/Chip"
import { Switch } from "@/components/admin-v2/primitives/Switch"
import { Icon, type IconName } from "@/components/admin-v2/primitives/Icon"
import { Avatar } from "@/components/admin-v2/primitives/Avatar"
import {
  ChipCell,
  DataTable,
  DateCell,
  TextCell,
  type ColumnConfig,
} from "@/components/admin-v2/datatable"
import { formatShortDate, formatTimeOfDay } from "@/lib/admin-v2/format"
import type { PlatformUserSlim } from "@/lib/admin-v2/data/server"

type TeamMember = {
  id: string
  name: string
  email: string
  role: "super_admin" | "admin" | "coordinator" | "crew" | "partner"
  status: "active" | "invited" | "suspended"
  lastSeenAt: string
}

const TEAM: TeamMember[] = [
  {
    id: "u1",
    name: "Simon Prusin",
    email: "simon@yugo.com",
    role: "super_admin",
    status: "active",
    lastSeenAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: "u2",
    name: "Andy Shepard",
    email: "andy@yugo.com",
    role: "admin",
    status: "active",
    lastSeenAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: "u3",
    name: "Emily Thompson",
    email: "emily@yugo.com",
    role: "coordinator",
    status: "active",
    lastSeenAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
  {
    id: "u4",
    name: "Michael Carter",
    email: "michael@yugo.com",
    role: "crew",
    status: "active",
    lastSeenAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: "u5",
    name: "Sophia Morgan",
    email: "sophia@artgallery.com",
    role: "partner",
    status: "invited",
    lastSeenAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
]

const ROLE_LABEL: Record<TeamMember["role"], string> = {
  super_admin: "SUPER ADMIN",
  admin: "ADMIN",
  coordinator: "COORDINATOR",
  crew: "CREW",
  partner: "PARTNER",
}

type Integration = {
  id: string
  name: string
  description: string
  icon: IconName
  status: "connected" | "disconnected" | "error"
  lastSync: string | null
}

const INTEGRATIONS: Integration[] = [
  {
    id: "hubspot",
    name: "HubSpot",
    description: "CRM pipeline sync",
    icon: "leads",
    status: "connected",
    lastSync: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
  },
  {
    id: "square",
    name: "Square",
    description: "Invoicing & payments",
    icon: "invoices",
    status: "connected",
    lastSync: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: "apollo",
    name: "Apollo",
    description: "Lead enrichment",
    icon: "sliders",
    status: "disconnected",
    lastSync: null,
  },
  {
    id: "twilio",
    name: "Twilio",
    description: "SMS notifications",
    icon: "message",
    status: "connected",
    lastSync: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: "mapbox",
    name: "Mapbox",
    description: "Mapping & routing",
    icon: "dispatch",
    status: "connected",
    lastSync: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
]

type AuditRow = {
  id: string
  user: string
  module: string
  action: string
  target: string
  at: string
}

const AUDIT: AuditRow[] = Array.from({ length: 18 }).map((_, index) => ({
  id: `log-${index}`,
  user: [
    "Simon Prusin",
    "Andy Shepard",
    "Emily Thompson",
    "Michael Carter",
  ][index % 4]!,
  module: ["leads", "quotes", "moves", "invoices", "pricing"][index % 5]!,
  action: [
    "Marked as won",
    "Sent quote",
    "Rescheduled move",
    "Voided invoice",
    "Updated base rate",
  ][index % 5]!,
  target: `#${1000 + index}`,
  at: new Date(Date.now() - index * 1000 * 60 * 37).toISOString(),
}))

const NOTIFY_PREFS: Array<{
  id: string
  event: string
  email: boolean
  sms: boolean
}> = [
  { id: "n1", event: "New lead assigned", email: true, sms: false },
  { id: "n2", event: "Quote viewed", email: true, sms: false },
  { id: "n3", event: "Move scheduled", email: true, sms: true },
  { id: "n4", event: "Crew late check-in", email: true, sms: true },
  { id: "n5", event: "Payment received", email: true, sms: false },
  { id: "n6", event: "At-risk move", email: true, sms: true },
]

type DateFactor = { id: string; factor_type: string; factor_value: string; multiplier: number }

async function saveDateFactors(rows: Array<{ id: string; multiplier: number }>): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/admin/pricing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ section: "date-factors", rows }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error ?? "Failed" }
    return { ok: true }
  } catch {
    return { ok: false, error: "Network error" }
  }
}

const PlatformTab = () => {
  const [weekend, setWeekend] = React.useState(10)
  const [peak, setPeak] = React.useState(10)
  const [saving, setSaving] = React.useState(false)
  // ids of the saturday/sunday rows and peak season row so we can update them
  const [weekendIds, setWeekendIds] = React.useState<string[]>([])
  const [peakId, setPeakId] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch("/api/admin/pricing?section=date-factors", { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) return
        const { data } = await res.json() as { data: DateFactor[] }
        if (!Array.isArray(data)) return
        const weekendRows = data.filter(
          (r) => r.factor_type === "day_of_week" && (r.factor_value === "saturday" || r.factor_value === "sunday"),
        )
        const peakRow = data.find((r) => r.factor_type === "season" && r.factor_value === "peak_jun_aug")
        if (weekendRows.length > 0) {
          const avgMultiplier = weekendRows.reduce((s, r) => s + r.multiplier, 0) / weekendRows.length
          setWeekend(Math.round((avgMultiplier - 1) * 100))
          setWeekendIds(weekendRows.map((r) => r.id))
        }
        if (peakRow) {
          setPeak(Math.round((peakRow.multiplier - 1) * 100))
          setPeakId(peakRow.id)
        }
      })
      .catch(() => { /* keep defaults */ })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const rows: Array<{ id: string; multiplier: number }> = [
      ...weekendIds.map((id) => ({ id, multiplier: 1 + weekend / 100 })),
      ...(peakId ? [{ id: peakId, multiplier: 1 + peak / 100 }] : []),
    ]
    if (rows.length === 0) {
      toast.info("No factors loaded — changes not saved")
      setSaving(false)
      return
    }
    const result = await saveDateFactors(rows)
    setSaving(false)
    if (result.ok) {
      toast.success("Platform multipliers saved")
    } else {
      toast.error(result.error ?? "Failed to save")
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-line bg-surface p-5">
        <header className="pb-4 border-b border-line">
          <h3 className="heading-sm text-fg">Platform multipliers</h3>
          <p className="body-sm text-fg-subtle mt-1">
            Applies globally to pricing simulations and saved quotes.
          </p>
        </header>
        <div className="grid gap-5 sm:grid-cols-2 pt-4">
          <label className="flex flex-col gap-1.5">
            <span className="label-sm text-fg-subtle">Weekend surcharge (%)</span>
            <input
              type="number"
              value={weekend}
              onChange={(event) => setWeekend(Number(event.target.value))}
              className="h-9 rounded-sm border border-line-strong bg-surface px-3 body-sm text-fg outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-sm text-fg-subtle">Peak season (%)</span>
            <input
              type="number"
              value={peak}
              onChange={(event) => setPeak(Number(event.target.value))}
              className="h-9 rounded-sm border border-line-strong bg-surface px-3 body-sm text-fg outline-none focus:border-accent"
            />
          </label>
        </div>
        <div className="pt-4 flex justify-end">
          <Button
            size="sm"
            variant="primary"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-5">
        <header>
          <h3 className="heading-sm text-fg">HubSpot pipeline IDs</h3>
          <p className="body-sm text-fg-subtle mt-1">
            Drive the Leads pipeline stages. Only admins can change these.
          </p>
        </header>
        <ul className="mt-4 space-y-2">
          {[
            { stage: "New", id: "12345678" },
            { stage: "Pre-sale", id: "12345679" },
            { stage: "Closing", id: "12345680" },
            { stage: "Closed", id: "12345681" },
            { stage: "Lost", id: "12345682" },
          ].map((row) => (
            <li
              key={row.stage}
              className="flex items-center justify-between rounded-md border border-line bg-surface-subtle px-3 py-2"
            >
              <span className="body-sm text-fg">{row.stage}</span>
              <span className="label-sm text-fg-subtle tabular-nums">
                {row.id}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

const toTeamMember = (pu: PlatformUserSlim): TeamMember => ({
  id: pu.userId,
  name: pu.name,
  email: pu.email,
  role: (["super_admin", "admin", "coordinator", "crew", "partner"].includes(pu.role)
    ? pu.role
    : "coordinator") as TeamMember["role"],
  status: "active",
  lastSeenAt: pu.createdAt,
})

const TeamTab = ({ team }: { team: TeamMember[] }) => {
  const columns = React.useMemo<ColumnConfig<TeamMember>[]>(
    () => [
      {
        id: "person",
        type: "identity",
        header: "Member",
        priority: "p1",
        minWidth: 220,
        value: (row) => row.name,
        render: (row) => (
          <div className="flex items-center gap-2">
            <Avatar name={row.name} size="sm" />
            <TextCell primary={row.name} secondary={row.email} />
          </div>
        ),
      },
      {
        id: "role",
        type: "chip",
        header: "Role",
        priority: "p1",
        sortable: true,
        filterable: true,
        groupable: true,
        value: (row) => row.role,
        render: (row) => (
          <ChipCell
            label={ROLE_LABEL[row.role]}
            variant={
              row.role === "super_admin"
                ? "brand"
                : row.role === "admin"
                  ? "info"
                  : "neutral"
            }
          />
        ),
      },
      {
        id: "status",
        type: "chip",
        header: "Status",
        priority: "p1",
        sortable: true,
        filterable: true,
        groupable: true,
        value: (row) => row.status,
        render: (row) => (
          <ChipCell
            label={row.status.toUpperCase()}
            variant={
              row.status === "active"
                ? "success"
                : row.status === "invited"
                  ? "warning"
                  : "danger"
            }
          />
        ),
      },
      {
        id: "last",
        type: "date",
        header: "Last seen",
        priority: "p2",
        sortable: true,
        filterable: true,
        value: (row) => new Date(row.lastSeenAt).getTime(),
        render: (row) => <DateCell value={row.lastSeenAt} />,
      },
    ],
    [],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="heading-sm text-fg">Team</h3>
        <Button
          size="sm"
          variant="primary"
          leadingIcon={<Icon name="plus" size="sm" weight="bold" />}
          onClick={() => toast.info("Invite flow opens here")}
        >
          Invite user
        </Button>
      </div>
      <DataTable
        data={team}
        columns={columns}
        getRowId={(row) => row.id}
        stateKey="team"
        moduleLabel="members"
        viewModes={["list"]}
        selectable={false}
      />
    </div>
  )
}

const IntegrationsTab = () => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {INTEGRATIONS.map((integration) => (
      <article
        key={integration.id}
        className="rounded-lg border border-line bg-surface p-5 flex flex-col gap-4"
      >
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-surface-subtle border border-line">
              <Icon name={integration.icon} size="md" weight="bold" />
            </span>
            <div>
              <h3 className="heading-sm text-fg">{integration.name}</h3>
              <p className="body-xs text-fg-subtle">
                {integration.description}
              </p>
            </div>
          </div>
          <Chip
            label={
              integration.status === "connected"
                ? "CONNECTED"
                : integration.status === "error"
                  ? "ERROR"
                  : "DISCONNECTED"
            }
            variant={
              integration.status === "connected"
                ? "success"
                : integration.status === "error"
                  ? "danger"
                  : "neutral"
            }
          />
        </header>
        <p className="body-xs text-fg-subtle">
          {integration.lastSync
            ? `Last sync ${formatTimeOfDay(integration.lastSync)}`
            : "Not yet connected"}
        </p>
        <div className="mt-auto flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => toast.info(`Configure ${integration.name}`)}
          >
            Configure
          </Button>
        </div>
      </article>
    ))}
  </div>
)

const NotificationsTab = () => {
  const [prefs, setPrefs] = React.useState(NOTIFY_PREFS)
  return (
    <section className="rounded-lg border border-line bg-surface">
      <header className="flex items-center justify-between px-5 py-3 border-b border-line">
        <h3 className="heading-sm text-fg">Notification preferences</h3>
        <p className="body-xs text-fg-subtle">
          Affects your account only.
        </p>
      </header>
      <table className="w-full body-sm">
        <thead className="bg-surface-subtle">
          <tr>
            <th className="px-5 py-2 text-left label-sm text-fg-subtle">
              Event
            </th>
            <th className="px-5 py-2 text-center label-sm text-fg-subtle">
              Email
            </th>
            <th className="px-5 py-2 text-center label-sm text-fg-subtle">
              SMS
            </th>
          </tr>
        </thead>
        <tbody>
          {prefs.map((row) => (
            <tr key={row.id} className="border-t border-line">
              <td className="px-5 py-3 text-fg">{row.event}</td>
              <td className="px-5 py-3">
                <div className="flex justify-center">
                  <Switch
                    checked={row.email}
                    onCheckedChange={(checked) =>
                      setPrefs((prev) =>
                        prev.map((p) =>
                          p.id === row.id
                            ? { ...p, email: Boolean(checked) }
                            : p,
                        ),
                      )
                    }
                    aria-label={`Email for ${row.event}`}
                  />
                </div>
              </td>
              <td className="px-5 py-3">
                <div className="flex justify-center">
                  <Switch
                    checked={row.sms}
                    onCheckedChange={(checked) =>
                      setPrefs((prev) =>
                        prev.map((p) =>
                          p.id === row.id
                            ? { ...p, sms: Boolean(checked) }
                            : p,
                        ),
                      )
                    }
                    aria-label={`SMS for ${row.event}`}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

const AuditTab = () => {
  const [rows, setRows] = React.useState<AuditRow[]>(AUDIT)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    fetch("/api/admin/audit-log?limit=200", { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok || cancelled) return
        const { logs } = await res.json() as { logs: Array<Record<string, unknown>> }
        if (cancelled || !Array.isArray(logs)) return
        const mapped: AuditRow[] = logs.map((log, idx) => ({
          id: String(log.id ?? idx),
          user: String(log.user_email ?? log.user_id ?? "System"),
          module: String(log.resource_type ?? log.action ?? "").split("_")[0] ?? "system",
          action: String(log.action ?? "").replace(/_/g, " "),
          target: String(log.resource_id ?? log.resource_type ?? "–"),
          at: String(log.created_at ?? new Date().toISOString()),
        }))
        setRows(mapped.length > 0 ? mapped : AUDIT)
      })
      .catch(() => { /* keep mock */ })
      .then(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const columns = React.useMemo<ColumnConfig<AuditRow>[]>(
    () => [
      {
        id: "user",
        type: "identity",
        header: "User",
        priority: "p1",
        minWidth: 180,
        sortable: true,
        filterable: true,
        value: (row) => row.user,
        render: (row) => <TextCell primary={row.user} />,
      },
      {
        id: "module",
        type: "chip",
        header: "Module",
        priority: "p1",
        sortable: true,
        filterable: true,
        groupable: true,
        value: (row) => row.module,
        render: (row) => (
          <ChipCell label={row.module.toUpperCase()} variant="neutral" />
        ),
      },
      {
        id: "action",
        type: "text",
        header: "Action",
        priority: "p1",
        sortable: true,
        filterable: true,
        value: (row) => row.action,
        render: (row) => <TextCell primary={row.action} />,
      },
      {
        id: "target",
        type: "text",
        header: "Target",
        priority: "p2",
        sortable: true,
        filterable: true,
        value: (row) => row.target,
        render: (row) => (
          <span className="body-sm text-fg tabular-nums">{row.target}</span>
        ),
      },
      {
        id: "at",
        type: "date",
        header: "When",
        priority: "p1",
        sortable: true,
        filterable: true,
        defaultSort: "desc",
        value: (row) => new Date(row.at).getTime(),
        render: (row) => (
          <span className="body-sm text-fg tabular-nums">
            {formatShortDate(row.at)} · {formatTimeOfDay(row.at)}
          </span>
        ),
      },
    ],
    [],
  )

  return (
    <DataTable
      data={rows}
      columns={columns}
      getRowId={(row) => row.id}
      stateKey="audit"
      moduleLabel="entries"
      viewModes={["list"]}
      selectable={false}
    />
  )
}

export type SettingsClientProps = {
  platformUsers?: PlatformUserSlim[]
}

export const SettingsClient = ({ platformUsers = [] }: SettingsClientProps) => {
  const team = React.useMemo(
    () => (platformUsers.length > 0 ? platformUsers.map(toTeamMember) : TEAM),
    [platformUsers],
  )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" />
      <Tabs defaultValue="platform">
        <TabsList>
          <TabsTrigger value="platform">Platform</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>
        <TabsContent value="platform" className="pt-6">
          <PlatformTab />
        </TabsContent>
        <TabsContent value="team" className="pt-6">
          <TeamTab team={team} />
        </TabsContent>
        <TabsContent value="integrations" className="pt-6">
          <IntegrationsTab />
        </TabsContent>
        <TabsContent value="notifications" className="pt-6">
          <NotificationsTab />
        </TabsContent>
        <TabsContent value="audit" className="pt-6">
          <AuditTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
