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
import { B2BDrawer } from "@/components/admin-v2/modules/b2b-drawer"
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
  B2B_STATUS_LABEL,
  VERTICAL_LABEL,
} from "@/lib/admin-v2/labels"
import { formatCurrencyCompact } from "@/lib/admin-v2/format"
import { downloadCsv } from "@/lib/admin-v2/csv"
import type { B2BPartner, Move, Vertical } from "@/lib/admin-v2/mock/types"
import { cn } from "@/components/admin-v2/lib/cn"

const VERTICAL_FILTERS: Array<{ id: "all" | Vertical; label: string }> = [
  { id: "all", label: "All" },
  { id: "furniture_retail", label: "Furniture retail" },
  { id: "flooring", label: "Flooring" },
  { id: "interior_designer", label: "Interior designer" },
  { id: "cabinetry", label: "Cabinetry" },
  { id: "medical_lab", label: "Medical / Lab" },
  { id: "appliance", label: "Appliance" },
  { id: "art_gallery", label: "Art / Gallery" },
  { id: "restaurant_hospitality", label: "Restaurant / Hospitality" },
  { id: "office_commercial", label: "Office / Commercial" },
  { id: "ecommerce_bulk", label: "E-commerce / Bulk" },
  { id: "property_management", label: "Property management" },
]

export type B2BClientProps = {
  initialPartners: B2BPartner[]
  moves?: Move[]
}

export const B2BClient = ({ initialPartners, moves = [] }: B2BClientProps) => {
  const [partners, setPartners] = React.useState<B2BPartner[]>(
    () => initialPartners,
  )
  React.useEffect(() => {
    setPartners(initialPartners)
  }, [initialPartners])
  const drawer = useDrawer("b2b")
  const activePartner = React.useMemo(
    () => partners.find((p) => p.id === drawer.id) ?? null,
    [partners, drawer.id],
  )
  const [vertical, setVertical] = React.useState<"all" | Vertical>("all")
  const rows = React.useMemo(
    () =>
      vertical === "all"
        ? partners
        : partners.filter((p) => p.vertical === vertical),
    [partners, vertical],
  )

  const metrics = React.useMemo(() => {
    const active = partners.filter((p) => p.status === "active").length
    const jobs = partners.reduce((s, p) => s + p.jobsLast30, 0)
    const revenue = partners.reduce((s, p) => s + p.revenueLast30, 0)
    const onTime =
      partners.reduce((s, p) => s + p.onTimePercent, 0) /
      (partners.length || 1)
    return { active, jobs, revenue, onTime }
  }, [partners])

  const columns = React.useMemo<ColumnConfig<B2BPartner>[]>(
    () => [
      {
        id: "partner",
        type: "identity",
        header: "Partner",
        priority: "p1",
        minWidth: 220,
        sortable: true,
        filterable: true,
        value: (row) => row.name,
        render: (row) => (
          <TextCell primary={row.name} secondary={row.primaryContact} />
        ),
      },
      {
        id: "vertical",
        type: "chip",
        header: "Vertical",
        priority: "p1",
        sortable: true,
        filterable: true,
        groupable: true,
        value: (row) => row.vertical,
        render: (row) => (
          <ChipCell label={VERTICAL_LABEL[row.vertical]} variant="neutral" />
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
            label={B2B_STATUS_LABEL[row.status]}
            variant={
              row.status === "active"
                ? "success"
                : row.status === "paused"
                  ? "warning"
                  : "neutral"
            }
          />
        ),
      },
      {
        id: "jobs",
        type: "numeric",
        header: "Jobs 30d",
        priority: "p2",
        sortable: true,
        filterable: true,
        defaultSort: "desc",
        value: (row) => row.jobsLast30,
        render: (row) => <NumericCell value={row.jobsLast30} />,
      },
      {
        id: "revenue",
        type: "numeric",
        header: "Revenue 30d",
        priority: "p2",
        sortable: true,
        filterable: true,
        value: (row) => row.revenueLast30,
        render: (row) => (
          <NumericCell
            value={row.revenueLast30}
            format={formatCurrencyCompact}
          />
        ),
      },
      {
        id: "onTime",
        type: "numeric",
        header: "On-time",
        priority: "p2",
        sortable: true,
        filterable: true,
        value: (row) => row.onTimePercent,
        render: (row) => (
          <NumericCell value={row.onTimePercent} precision={1} />
        ),
      },
    ],
    [],
  )

  const bulkActions = React.useMemo<BulkAction<B2BPartner>[]>(
    () => [
      {
        id: "statement",
        label: "Generate statement",
        handler: (rows) => {
          toast.success(`Statements queued for ${rows.length} partners`)
        },
      },
      {
        id: "export",
        label: "Download as .CSV",
        handler: (rows) => {
          downloadCsv(
            ["Partner", "Vertical", "Status", "Contact", "Email", "Jobs (30d)", "Revenue (30d)", "On-time %"],
            rows.map((r) => [r.name, r.vertical, r.status, r.primaryContact, r.email, r.jobsLast30, r.revenueLast30, r.onTimePercent]),
            `yugo-b2b-partners-${new Date().toISOString().slice(0, 10)}`,
          )
          toast.success(`Downloaded ${rows.length} partners`)
        },
      },
      {
        id: "pause",
        label: "Pause partner",
        destructive: true,
        handler: (rows) => {
          toast.error(`Paused ${rows.length} partners`)
        },
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="B2B partners"
        actions={
          <NewPartnerModal onCreated={(p) => setPartners((prev) => [p, ...prev])} />
        }
      />

      <MetricStrip
        items={[
          { label: "Active partners", value: metrics.active.toString() },
          { label: "Jobs (30d)", value: metrics.jobs.toString() },
          {
            label: "Revenue (30d)",
            value: formatCurrencyCompact(metrics.revenue),
          },
          {
            label: "On-time",
            value: `${metrics.onTime.toFixed(1)}%`,
          },
        ]}
      />

      <div className="flex flex-wrap gap-2">
        {VERTICAL_FILTERS.map((filter) => {
          const active = vertical === filter.id
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setVertical(filter.id)}
              className={cn(
                "rounded-full border px-3 py-1 label-sm transition-colors",
                active
                  ? "border-transparent bg-fg text-surface"
                  : "border-line bg-surface text-fg hover:bg-surface-subtle",
              )}
            >
              {filter.label}
            </button>
          )
        })}
      </div>

      <DataTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        stateKey="b2b"
        moduleLabel="partners"
        bulkActions={bulkActions}
        viewModes={["list"]}
        onRowClick={(row) => drawer.open(row.id)}
      />

      <B2BDrawer
        partner={activePartner}
        open={drawer.isOpen}
        onOpenChange={drawer.setOpen}
        moves={moves}
      />
    </div>
  )
}

const VERTICAL_OPTIONS: { value: string; label: string }[] = [
  { value: "furniture_retail", label: "Furniture retail" },
  { value: "appliance", label: "Appliance" },
  { value: "flooring", label: "Flooring" },
  { value: "interior_designer", label: "Interior design" },
  { value: "cabinetry", label: "Cabinetry" },
  { value: "ecommerce_bulk", label: "E-commerce / bulk" },
  { value: "medical_lab", label: "Medical / lab" },
  { value: "art_gallery", label: "Art gallery" },
  { value: "restaurant_hospitality", label: "Restaurant / hospitality" },
  { value: "office_commercial", label: "Office / commercial" },
]

const NewPartnerModal = ({ onCreated }: { onCreated: (partner: B2BPartner) => void }) => {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [contactName, setContactName] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [vertical, setVertical] = React.useState("furniture_retail")
  const [saving, setSaving] = React.useState(false)

  const reset = () => { setName(""); setEmail(""); setContactName(""); setPhone(""); setVertical("furniture_retail") }

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
          type: vertical,
          skip_invite_email: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create partner")
      } else {
        const raw = data.organization ?? data
        const newPartner: B2BPartner = {
          id: raw.id ?? String(Date.now()),
          name: name.trim(),
          vertical: vertical as Vertical,
          primaryContact: contactName.trim() || name.trim(),
          email: email.trim(),
          phone: phone.trim() || "",
          jobsLast30: 0,
          revenueLast30: 0,
          onTimePercent: 100,
          status: "active",
          createdAt: raw.created_at ?? new Date().toISOString(),
        }
        toast.success(`Partner ${name.trim()} created`)
        onCreated(newPartner)
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
          New partner
        </Button>
      </ModalTrigger>
      <ModalContent size="sm">
        <ModalHeader title="Add B2B partner" description="Onboard a new delivery partner or commercial client." />
        <div className="space-y-3">
          <div>
            <label className="label-sm text-fg-subtle block mb-1">Company name *</label>
            <Input
              type="text"
              placeholder="Acme Furniture Co."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label-sm text-fg-subtle block mb-1">Contact email *</label>
            <Input
              type="email"
              placeholder="ops@acme.com"
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
            <label className="label-sm text-fg-subtle block mb-1">Vertical</label>
            <select
              value={vertical}
              onChange={(e) => setVertical(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 body-sm text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              {VERTICAL_OPTIONS.map((v) => (
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
            {saving ? "Creating…" : "Create partner"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
