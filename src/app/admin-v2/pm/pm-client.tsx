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
  NumericCell,
  TextCell,
  type BulkAction,
  type ColumnConfig,
} from "@/components/admin-v2/datatable"
import { PMDrawer } from "@/components/admin-v2/modules/pm-drawer"
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
import { PM_CONTRACT_LABEL } from "@/lib/admin-v2/labels"
import { downloadCsv } from "@/lib/admin-v2/csv"
import type { PMAccount, Move } from "@/lib/admin-v2/mock/types"

export type PMClientProps = {
  initialAccounts: PMAccount[]
  moves?: Move[]
}

export const PMClient = ({ initialAccounts, moves = [] }: PMClientProps) => {
  const [accounts, setAccounts] = React.useState<PMAccount[]>(() => initialAccounts)
  React.useEffect(() => {
    setAccounts(initialAccounts)
  }, [initialAccounts])
  const drawer = useDrawer("pm")
  const activeAccount = React.useMemo(
    () => accounts.find((a) => a.id === drawer.id) ?? null,
    [accounts, drawer.id],
  )

  const metrics = React.useMemo(() => {
    const active = accounts.filter((a) => a.contractStatus === "active").length
    const renewal = accounts.filter((a) => a.contractStatus === "renewal").length
    const buildings = accounts.reduce((s, a) => s + a.buildings, 0)
    const moves = accounts.reduce((s, a) => s + a.movesLast30, 0)
    return { active, renewal, buildings, moves }
  }, [accounts])

  const columns = React.useMemo<ColumnConfig<PMAccount>[]>(
    () => [
      {
        id: "account",
        type: "identity",
        header: "Account",
        priority: "p1",
        minWidth: 240,
        sortable: true,
        filterable: true,
        value: (row) => row.name,
        render: (row) => (
          <TextCell primary={row.name} secondary={row.primaryContact} />
        ),
      },
      {
        id: "contract",
        type: "chip",
        header: "Contract",
        priority: "p1",
        sortable: true,
        filterable: true,
        groupable: true,
        value: (row) => row.contractStatus,
        render: (row) => (
          <ChipCell
            label={PM_CONTRACT_LABEL[row.contractStatus]}
            variant={
              row.contractStatus === "active"
                ? "success"
                : row.contractStatus === "renewal"
                  ? "warning"
                  : "danger"
            }
          />
        ),
      },
      {
        id: "buildings",
        type: "numeric",
        header: "Buildings",
        priority: "p2",
        sortable: true,
        filterable: true,
        defaultSort: "desc",
        value: (row) => row.buildings,
        render: (row) => <NumericCell value={row.buildings} />,
      },
      {
        id: "moves",
        type: "numeric",
        header: "Moves 30d",
        priority: "p2",
        sortable: true,
        filterable: true,
        value: (row) => row.movesLast30,
        render: (row) => <NumericCell value={row.movesLast30} />,
      },
    ],
    [],
  )

  const bulkActions = React.useMemo<BulkAction<PMAccount>[]>(
    () => [
      {
        id: "statement",
        label: "Generate statements",
        handler: (rows) => {
          toast.success(`Statements queued for ${rows.length} accounts`)
        },
      },
      {
        id: "export",
        label: "Download as .CSV",
        handler: (rows) => {
          downloadCsv(
            ["Account", "Contact", "Email", "Buildings", "Moves (30d)", "Contract", "Onboarded"],
            rows.map((r) => [r.name, r.primaryContact, r.email, r.buildings, r.movesLast30, r.contractStatus, r.createdAt]),
            `yugo-pm-accounts-${new Date().toISOString().slice(0, 10)}`,
          )
          toast.success(`Downloaded ${rows.length} accounts`)
        },
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Property management"
        actions={
          <NewPMModal onCreated={(account) => setAccounts((prev) => [account, ...prev])} />
        }
      />

      <MetricStrip
        items={[
          { label: "Active accounts", value: metrics.active.toString() },
          { label: "Renewal", value: metrics.renewal.toString() },
          { label: "Buildings", value: metrics.buildings.toString() },
          { label: "Moves (30d)", value: metrics.moves.toString() },
        ]}
      />

      <DataTable
        data={accounts}
        columns={columns}
        getRowId={(row) => row.id}
        stateKey="pm"
        moduleLabel="accounts"
        bulkActions={bulkActions}
        viewModes={["list"]}
        onRowClick={(row) => drawer.open(row.id)}
      />

      <PMDrawer
        account={activeAccount}
        open={drawer.isOpen}
        onOpenChange={drawer.setOpen}
        moves={moves}
      />
    </div>
  )
}

const PM_TYPE_OPTIONS = [
  { value: "property_management_residential", label: "Residential" },
  { value: "property_management_commercial", label: "Commercial" },
  { value: "developer_builder", label: "Developer / Builder" },
]

const NewPMModal = ({ onCreated }: { onCreated: (account: PMAccount) => void }) => {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [contactName, setContactName] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [pmType, setPmType] = React.useState("property_management_residential")
  const [saving, setSaving] = React.useState(false)

  const reset = () => { setName(""); setEmail(""); setContactName(""); setPhone(""); setPmType("property_management_residential") }

  const handleCreate = async () => {
    if (!name.trim() || !email.trim()) { toast.error("Company name and email are required"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/invite/partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          contact_name: contactName.trim() || name.trim(),
          phone: phone.trim() || null,
          type: pmType,
          skip_invite_email: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create PM account")
      } else {
        const raw = data.organization ?? data
        const newAccount: PMAccount = {
          id: raw.id ?? String(Date.now()),
          name: name.trim(),
          primaryContact: contactName.trim() || name.trim(),
          email: email.trim(),
          buildings: 0,
          movesLast30: 0,
          contractStatus: "active",
          createdAt: raw.created_at ?? new Date().toISOString(),
        }
        toast.success(`PM account ${name.trim()} created`)
        onCreated(newAccount)
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
          New account
        </Button>
      </ModalTrigger>
      <ModalContent size="sm">
        <ModalHeader title="Add PM account" description="Onboard a new property management company or developer." />
        <div className="space-y-3">
          <div>
            <label className="label-sm text-fg-subtle block mb-1">Company name *</label>
            <Input
              type="text"
              placeholder="Skyline Properties"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label-sm text-fg-subtle block mb-1">Contact email *</label>
            <Input
              type="email"
              placeholder="ops@skyline.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-sm text-fg-subtle block mb-1">Contact name</label>
              <Input
                type="text"
                placeholder="Jane Smith"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div>
              <label className="label-sm text-fg-subtle block mb-1">Phone</label>
              <Input
                type="tel"
                placeholder="+1 416 555 0100"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label-sm text-fg-subtle block mb-1">Account type</label>
            <select
              value={pmType}
              onChange={(e) => setPmType(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 body-sm text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              {PM_TYPE_OPTIONS.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>
        <ModalFooter>
          <ModalClose asChild>
            <Button variant="secondary" size="sm">Cancel</Button>
          </ModalClose>
          <Button variant="primary" size="sm" disabled={saving} onClick={handleCreate}>
            {saving ? "Creating…" : "Create account"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
