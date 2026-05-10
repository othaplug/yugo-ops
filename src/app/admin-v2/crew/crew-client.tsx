"use client"

import * as React from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/admin-v2/composites/PageHeader"
import { MetricStrip } from "@/components/admin-v2/composites/MetricCard"
import { Button } from "@/components/admin-v2/primitives/Button"
import { Icon } from "@/components/admin-v2/primitives/Icon"
import {
  ChipCell,
  DataTable,
  DateCell,
  NumericCell,
  TextCell,
  type BulkAction,
  type ColumnConfig,
} from "@/components/admin-v2/datatable"
import { CrewDrawer } from "@/components/admin-v2/modules/crew-drawer"
import { useDrawer } from "@/components/admin-v2/layout/useDrawer"
import { Input } from "@/components/admin-v2/primitives/Input"
import {
  Modal,
  ModalClose,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTrigger,
} from "@/components/admin-v2/layout/Modal"
import {
  CREW_AVAILABILITY_LABEL,
  CREW_ROLE_LABEL,
} from "@/lib/admin-v2/labels"
import { formatPercent } from "@/lib/admin-v2/format"
import { downloadCsv } from "@/lib/admin-v2/csv"
import type { CrewMember, Move } from "@/lib/admin-v2/mock/types"

async function bulkSetCrewActive(ids: string[], is_active: boolean): Promise<{ failCount: number }> {
  const results = await Promise.allSettled(
    ids.map((id) =>
      fetch(`/api/admin/crew-members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ is_active }),
      }).then((r) => r.ok),
    ),
  )
  const failCount = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value)).length
  return { failCount }
}

export type CrewClientProps = {
  initialCrew: CrewMember[]
  moves?: Move[]
}

export const CrewClient = ({ initialCrew, moves = [] }: CrewClientProps) => {
  const [crew, setCrew] = React.useState<CrewMember[]>(() => initialCrew)
  React.useEffect(() => {
    setCrew(initialCrew)
  }, [initialCrew])
  const drawer = useDrawer("crew")
  const activeMember = React.useMemo(
    () => crew.find((c) => c.id === drawer.id) ?? null,
    [drawer.id, crew],
  )

  const metrics = React.useMemo(() => {
    const available = crew.filter((c) => c.availability === "available").length
    const onMove = crew.filter((c) => c.availability === "on-move").length
    const off = crew.filter((c) => c.availability === "off-duty").length
    const avgRating =
      crew.reduce((sum, c) => sum + c.rating, 0) / (crew.length || 1)
    return { available, onMove, off, avgRating }
  }, [crew])

  const columns = React.useMemo<ColumnConfig<CrewMember>[]>(
    () => [
      {
        id: "crew",
        type: "identity",
        header: "Crew",
        priority: "p1",
        minWidth: 220,
        sortable: true,
        filterable: true,
        value: (row) => row.name,
        render: (row) => <TextCell primary={row.name} secondary={row.email} />,
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
          <ChipCell label={CREW_ROLE_LABEL[row.role]} variant="neutral" />
        ),
      },
      {
        id: "availability",
        type: "chip",
        header: "Availability",
        priority: "p1",
        sortable: true,
        filterable: true,
        groupable: true,
        value: (row) => row.availability,
        render: (row) => (
          <ChipCell
            label={CREW_AVAILABILITY_LABEL[row.availability]}
            variant={
              row.availability === "available"
                ? "success"
                : row.availability === "on-move"
                  ? "info"
                  : "neutral"
            }
          />
        ),
      },
      {
        id: "rating",
        type: "numeric",
        header: "Rating",
        priority: "p2",
        sortable: true,
        filterable: true,
        defaultSort: "desc",
        value: (row) => row.rating,
        render: (row) => (
          <NumericCell value={row.rating} precision={1} />
        ),
      },
      {
        id: "moves",
        type: "numeric",
        header: "Moves",
        priority: "p2",
        sortable: true,
        filterable: true,
        value: (row) => row.movesCompleted,
        render: (row) => <NumericCell value={row.movesCompleted} />,
      },
      {
        id: "damage",
        type: "numeric",
        header: "Damage",
        priority: "p2",
        sortable: true,
        filterable: true,
        value: (row) => row.damageRate,
        render: (row) => (
          <NumericCell value={row.damageRate} precision={2} />
        ),
      },
      {
        id: "next",
        type: "date",
        header: "Next shift",
        priority: "p2",
        sortable: true,
        filterable: true,
        value: (row) =>
          row.nextAssignmentAt ? new Date(row.nextAssignmentAt).getTime() : 0,
        render: (row) =>
          row.nextAssignmentAt ? (
            <DateCell value={row.nextAssignmentAt} />
          ) : (
            <span className="body-sm text-fg-subtle">Unscheduled</span>
          ),
      },
    ],
    [],
  )

  const bulkActions = React.useMemo<BulkAction<CrewMember>[]>(
    () => [
      {
        id: "message",
        label: "Message",
        handler: (rows) => {
          toast.info(`Messaging ${rows.length} crew`)
        },
      },
      {
        id: "off",
        label: "Set off duty",
        handler: async (rows) => {
          const ids = rows.map((r) => r.id)
          const { failCount } = await bulkSetCrewActive(ids, false)
          const idSet = new Set(ids)
          setCrew((prev) =>
            prev.map((c) => idSet.has(c.id) ? { ...c, availability: "off-duty" as CrewMember["availability"] } : c),
          )
          if (failCount === 0) {
            toast.success(`${rows.length} crew set off duty`)
          } else {
            toast.error(`${failCount} crew member(s) failed to update`)
          }
        },
      },
      {
        id: "export",
        label: "Download as .CSV",
        handler: (rows) => {
          downloadCsv(
            ["Name", "Role", "Availability", "Moves completed", "Rating", "Damage rate"],
            rows.map((r) => [r.name, r.role, r.availability, r.movesCompleted, r.rating, r.damageRate]),
            `yugo-crew-${new Date().toISOString().slice(0, 10)}`,
          )
          toast.success(`Downloaded ${rows.length} crew`)
        },
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Crew"
        actions={
          <InviteCrewModal onCreated={(member) => setCrew((prev) => [member, ...prev])} />
        }
      />

      <MetricStrip
        items={[
          { label: "Available", value: metrics.available.toString() },
          { label: "On move", value: metrics.onMove.toString() },
          { label: "Off duty", value: metrics.off.toString() },
          {
            label: "Avg rating",
            value: metrics.avgRating.toFixed(1),
          },
        ]}
      />

      <DataTable
        data={crew}
        columns={columns}
        getRowId={(row) => row.id}
        stateKey="crew"
        moduleLabel="crew"
        bulkActions={bulkActions}
        viewModes={["list"]}
        onRowClick={(row) => drawer.open(row.id)}
      />

      <CrewDrawer
        crew={activeMember}
        open={drawer.isOpen}
        onOpenChange={drawer.setOpen}
        moves={moves}
        onAvailabilityChange={(crewId, availability) => {
          setCrew((prev) =>
            prev.map((c) =>
              c.id === crewId ? { ...c, availability } : c,
            ),
          )
        }}
      />
    </div>
  )
}

type CrewTeam = { id: string; name: string }

const CREW_ROLE_OPTIONS = [
  { value: "lead", label: "Lead" },
  { value: "mover", label: "Mover" },
  { value: "driver", label: "Driver" },
  { value: "specialist", label: "Specialist" },
]

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

const InviteCrewModal = ({ onCreated }: { onCreated: (member: CrewMember) => void }) => {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState("mover")
  const [teamId, setTeamId] = React.useState("")
  const [pin, setPin] = React.useState(() => generatePin())
  const [teams, setTeams] = React.useState<CrewTeam[]>([])
  const [teamsLoading, setTeamsLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const reset = () => {
    setName(""); setPhone(""); setEmail(""); setRole("mover"); setTeamId(""); setPin(generatePin())
  }

  React.useEffect(() => {
    if (!open) return
    setTeamsLoading(true)
    fetch("/api/admin/crews", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data: CrewTeam[]) => {
        setTeams(Array.isArray(data) ? data : [])
        if (Array.isArray(data) && data.length > 0) setTeamId(data[0].id)
      })
      .catch(() => setTeams([]))
      .finally(() => setTeamsLoading(false))
  }, [open])

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Name is required"); return }
    if (!phone.trim()) { toast.error("Phone is required"); return }
    if (!teamId) { toast.error("Team is required"); return }
    if (!/^\d{6}$/.test(pin)) { toast.error("PIN must be 6 digits"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/admin/crew-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          role,
          team_id: teamId,
          pin,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create crew member")
      } else {
        const raw = data.member ?? data
        const newMember: CrewMember = {
          id: raw.id ?? String(Date.now()),
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role: role as CrewMember["role"],
          availability: "off-duty",
          rating: 5,
          damageRate: 0,
          movesCompleted: 0,
          nextAssignmentAt: null,
        }
        toast.success(`${name.trim()} added to crew`)
        onCreated(newMember)
        setOpen(false)
        reset()
      }
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <ModalTrigger asChild>
        <Button variant="secondary" size="sm" leadingIcon={<Icon name="plus" size="sm" weight="bold" />}>
          New crew
        </Button>
      </ModalTrigger>
      <ModalContent size="sm">
        <ModalHeader title="Add crew member" description="Invite a new mover, driver, or lead to the portal." />
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-sm text-fg-subtle block mb-1">Name *</label>
              <Input
                type="text"
                placeholder="Alex Johnson"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="label-sm text-fg-subtle block mb-1">Phone *</label>
              <Input
                type="tel"
                placeholder="+1 416 555 0100"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label-sm text-fg-subtle block mb-1">Email</label>
            <Input
              type="email"
              placeholder="alex@example.com (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-sm text-fg-subtle block mb-1">Role *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-md border border-line bg-surface px-3 py-2 body-sm text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                {CREW_ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-sm text-fg-subtle block mb-1">Team *</label>
              {teamsLoading ? (
                <div className="h-9 rounded-md border border-line bg-surface animate-pulse" />
              ) : (
                <select
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="w-full rounded-md border border-line bg-surface px-3 py-2 body-sm text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                >
                  {teams.length === 0 && <option value="">No teams found</option>}
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div>
            <label className="label-sm text-fg-subtle block mb-1">Portal PIN (6 digits)</label>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="6-digit PIN"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="flex-1"
              />
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setPin(generatePin())}
              >
                Regenerate
              </Button>
            </div>
          </div>
        </div>
        <ModalFooter>
          <ModalClose asChild>
            <Button variant="secondary" size="sm">Cancel</Button>
          </ModalClose>
          <Button variant="primary" size="sm" disabled={saving || teamsLoading || teams.length === 0} onClick={handleCreate}>
            {saving ? "Adding…" : "Add crew member"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
