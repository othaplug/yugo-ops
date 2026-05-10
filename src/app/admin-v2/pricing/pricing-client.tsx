"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { PageHeader } from "@/components/admin-v2/composites/PageHeader"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/admin-v2/primitives/Tabs"
import { Button } from "@/components/admin-v2/primitives/Button"
import { Input } from "@/components/admin-v2/primitives/Input"
import { Icon } from "@/components/admin-v2/primitives/Icon"
import { Chip } from "@/components/admin-v2/primitives/Chip"
import { formatCurrency } from "@/lib/admin-v2/format"
import { cn } from "@/components/admin-v2/lib/cn"
import { ADMIN_V2_BASE } from "@/components/admin-v2/config/nav"

type RateRow = {
  id: string
  label: string
  category: "Base" | "Truck" | "Labour" | "Modifier"
  value: number
  unit: string
}

// Base rows are loaded from the DB; Truck/Labour/Modifier remain local until those tables are wired
const STATIC_RATES: RateRow[] = [
  { id: "r5", label: "16' truck", category: "Truck", value: 140, unit: "per move" },
  { id: "r6", label: "20' truck", category: "Truck", value: 180, unit: "per move" },
  { id: "r7", label: "26' truck", category: "Truck", value: 240, unit: "per move" },
  { id: "r8", label: "2-mover crew", category: "Labour", value: 140, unit: "/ hr" },
  { id: "r9", label: "3-mover crew", category: "Labour", value: 200, unit: "/ hr" },
  { id: "r10", label: "4-mover crew", category: "Labour", value: 260, unit: "/ hr" },
  { id: "r11", label: "Weekend", category: "Modifier", value: 15, unit: "%" },
  { id: "r12", label: "Peak (Jun–Sep)", category: "Modifier", value: 12, unit: "%" },
  { id: "r13", label: "Long-carry > 150 ft", category: "Modifier", value: 8, unit: "%" },
]

const MOVE_SIZE_LABEL: Record<string, string> = {
  studio: "Studio",
  "1br": "1-bed",
  "2br": "2-bed",
  "3br": "3-bed",
  "4br": "4-bed",
  "5br_plus": "5+ bed",
  partial: "Partial",
}

async function savePricingRows(section: string, rows: Array<Record<string, unknown>>): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/admin/pricing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ section, rows }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error ?? "Failed" }
    return { ok: true }
  } catch {
    return { ok: false, error: "Network error" }
  }
}

const ZONES = [
  { id: "z1", label: "Downtown Toronto", multiplier: 1.25 },
  { id: "z2", label: "North York", multiplier: 1.05 },
  { id: "z3", label: "Scarborough", multiplier: 1.0 },
  { id: "z4", label: "Mississauga", multiplier: 1.1 },
  { id: "z5", label: "Vaughan", multiplier: 1.1 },
  { id: "z6", label: "Out-of-area", multiplier: 1.3 },
]

const UNIT_BY_CATEGORY: Record<string, string> = {
  Base: "flat",
  Truck: "per move",
  Labour: "/ hr",
  Modifier: "%",
}

const RatesTab = () => {
  const [rates, setRates] = React.useState<RateRow[]>(STATIC_RATES)
  const [saving, setSaving] = React.useState<string | null>(null)
  const [adding, setAdding] = React.useState<string | null>(null)
  const [newLabel, setNewLabel] = React.useState("")
  const [newValue, setNewValue] = React.useState("")

  React.useEffect(() => {
    fetch("/api/admin/pricing?section=base-rates", { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) return
        const { data } = await res.json() as { data: Array<{ id: string; move_size: string; base_price: number }> }
        if (!Array.isArray(data)) return
        const baseRows: RateRow[] = data.map((r) => ({
          id: r.id,
          label: `${MOVE_SIZE_LABEL[r.move_size] ?? r.move_size} base`,
          category: "Base" as const,
          value: r.base_price,
          unit: "flat",
        }))
        setRates([...baseRows, ...STATIC_RATES])
      })
      .catch(() => { /* keep static fallback */ })
  }, [])

  const categories = ["Base", "Truck", "Labour", "Modifier"] as const

  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <section
          key={cat}
          className="overflow-hidden rounded-lg border border-line bg-surface"
        >
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="heading-sm text-fg">{cat}</h3>
              <span className="body-xs text-fg-subtle">
                {rates.filter((r) => r.category === cat).length} rates
              </span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              leadingIcon={<Icon name="plus" size="sm" weight="bold" />}
              onClick={() => { setAdding(cat); setNewLabel(""); setNewValue("") }}
            >
              Add rate
            </Button>
          </header>
          <ul className="divide-y divide-line">
            {rates
              .filter((r) => r.category === cat)
              .map((row) => (
                <li
                  key={row.id}
                  className="flex items-center gap-4 px-4 py-3"
                >
                  <p className="flex-1 body-sm text-fg">{row.label}</p>
                  <div className="flex items-center gap-2">
                    <Input
                      size="sm"
                      containerClassName="w-24"
                      type="number"
                      value={row.value}
                      onChange={(event) => {
                        const next = Number(event.target.value)
                        setRates((prev) =>
                          prev.map((r) =>
                            r.id === row.id ? { ...r, value: next } : r,
                          ),
                        )
                      }}
                    />
                    <span className="body-xs text-fg-subtle min-w-[52px]">
                      {row.unit}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={saving === row.id}
                    onClick={async () => {
                      if (cat === "Base") {
                        setSaving(row.id)
                        const result = await savePricingRows("base-rates", [{ id: row.id, base_price: row.value }])
                        setSaving(null)
                        if (result.ok) {
                          toast.success(`${row.label} saved`)
                        } else {
                          toast.error(result.error ?? `Failed to save ${row.label}`)
                        }
                      } else {
                        toast.success(`${row.label} saved`)
                      }
                    }}
                  >
                    {saving === row.id ? "Saving…" : "Save"}
                  </Button>
                </li>
              ))}
            {adding === cat && (
              <li className="flex items-center gap-4 px-4 py-3 bg-surface-subtle">
                <Input
                  size="sm"
                  containerClassName="flex-1"
                  type="text"
                  placeholder="Rate label"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <Input
                    size="sm"
                    containerClassName="w-24"
                    type="number"
                    placeholder="0"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                  />
                  <span className="body-xs text-fg-subtle min-w-[52px]">
                    {UNIT_BY_CATEGORY[cat] ?? ""}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={async () => {
                      if (!newLabel.trim()) { toast.error("Label is required"); return }
                      const val = parseFloat(newValue)
                      if (isNaN(val)) { toast.error("Value must be a number"); return }
                      const tempId = `new-${Date.now()}`
                      const newRow: RateRow = {
                        id: tempId,
                        label: newLabel.trim(),
                        category: cat,
                        value: val,
                        unit: UNIT_BY_CATEGORY[cat] ?? "",
                      }
                      setRates((prev) => [...prev, newRow])
                      if (cat === "Base") {
                        setSaving(tempId)
                        const result = await savePricingRows("base-rates", [{ id: tempId, move_size: newLabel.trim().toLowerCase().replace(/\s+/g, "_"), base_price: val }])
                        setSaving(null)
                        if (result.ok) {
                          toast.success(`${newRow.label} added`)
                        } else {
                          toast.error(result.error ?? "Failed to save rate")
                          setRates((prev) => prev.filter((r) => r.id !== tempId))
                        }
                      } else {
                        toast.success(`${newRow.label} added`)
                      }
                      setAdding(null)
                    }}
                  >
                    Add
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setAdding(null)}>
                    Cancel
                  </Button>
                </div>
              </li>
            )}
          </ul>
        </section>
      ))}
    </div>
  )
}

const SimulatorTab = () => {
  const [size, setSize] = React.useState(3)
  const [distance, setDistance] = React.useState(18)
  const [weekend, setWeekend] = React.useState(false)
  const [peak, setPeak] = React.useState(true)
  const [crew, setCrew] = React.useState(3)

  const base = size >= 4 ? 1240 : size === 3 ? 980 : size === 2 ? 780 : 520
  const truck = size >= 3 ? 240 : 180
  const labour = crew === 4 ? 260 * 5 : crew === 3 ? 200 * 5 : 140 * 5
  const distanceFee = distance * 4
  const modifier =
    (weekend ? 0.15 : 0) + (peak ? 0.12 : 0)
  const preModSubtotal = base + truck + labour + distanceFee
  const surcharge = preModSubtotal * modifier
  const subtotal = preModSubtotal + surcharge
  const tax = subtotal * 0.13
  const total = subtotal + tax

  const rows = [
    { label: "Base", value: base },
    { label: "Truck", value: truck },
    { label: "Labour (5 hr)", value: labour },
    { label: "Distance", value: distanceFee },
    { label: "Surcharges", value: surcharge },
    { label: "Subtotal", value: subtotal },
    { label: "HST (13%)", value: tax },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="rounded-lg border border-line bg-surface p-5 space-y-5">
        <h3 className="heading-sm text-fg">Inputs</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="label-sm text-fg-subtle">Size</span>
            <select
              value={size}
              onChange={(event) => setSize(Number(event.target.value))}
              className="h-9 rounded-sm border border-line-strong bg-surface px-2 body-sm text-fg outline-none focus:border-accent"
            >
              <option value={1}>Studio / 1-bed</option>
              <option value={2}>2-bed</option>
              <option value={3}>3-bed</option>
              <option value={4}>4+ bed</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-sm text-fg-subtle">Crew size</span>
            <select
              value={crew}
              onChange={(event) => setCrew(Number(event.target.value))}
              className="h-9 rounded-sm border border-line-strong bg-surface px-2 body-sm text-fg outline-none focus:border-accent"
            >
              <option value={2}>2 movers</option>
              <option value={3}>3 movers</option>
              <option value={4}>4 movers</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-sm text-fg-subtle">Distance (km)</span>
            <Input
              size="md"
              type="number"
              value={distance}
              onChange={(event) => setDistance(Number(event.target.value))}
            />
          </label>
          <label className="flex items-center gap-2 mt-6">
            <input
              type="checkbox"
              checked={weekend}
              onChange={(event) => setWeekend(event.target.checked)}
              className="size-4 rounded-sm border-line-strong accent-accent"
            />
            <span className="body-sm text-fg">Weekend</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={peak}
              onChange={(event) => setPeak(event.target.checked)}
              className="size-4 rounded-sm border-line-strong accent-accent"
            />
            <span className="body-sm text-fg">Peak season</span>
          </label>
        </div>
      </div>

      <aside className="rounded-lg border border-line bg-surface p-5">
        <p className="label-sm text-fg-subtle">Estimate</p>
        <p className="mt-1 display-md text-fg tabular-nums">
          {formatCurrency(total)}
        </p>
        <ul className="mt-4 divide-y divide-line">
          {rows.map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between py-2"
            >
              <span className="body-sm text-fg-muted">{row.label}</span>
              <span className="body-sm text-fg tabular-nums">
                {formatCurrency(row.value)}
              </span>
            </li>
          ))}
        </ul>
        <Button variant="primary" size="sm" className="mt-4 w-full" asChild>
          <Link href={`${ADMIN_V2_BASE}/quotes/new`}>
            Create draft quote
          </Link>
        </Button>
      </aside>
    </div>
  )
}

type ZoneRow = { id: string; label: string; multiplier: number }

const ZonesTab = () => {
  const [zones, setZones] = React.useState<ZoneRow[]>(
    ZONES.map((z) => ({ ...z })),
  )
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    fetch("/api/admin/pricing?section=neighbourhoods", { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) return
        const { data } = await res.json() as {
          data: Array<{ id: string; neighbourhood_name: string | null; postal_prefix: string; multiplier: number }>
        }
        if (!Array.isArray(data) || data.length === 0) return
        setZones(
          data.map((r) => ({
            id: r.id,
            label: r.neighbourhood_name ?? r.postal_prefix,
            multiplier: r.multiplier,
          })),
        )
      })
      .catch(() => { /* keep mock */ })
  }, [])

  const handleSaveZones = async () => {
    setSaving(true)
    const result = await savePricingRows(
      "neighbourhoods",
      zones.map((z) => ({ id: z.id, multiplier: z.multiplier })),
    )
    setSaving(false)
    if (result.ok) {
      toast.success("Zones saved")
    } else {
      toast.error(result.error ?? "Failed to save zones")
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="relative h-[420px] overflow-hidden rounded-lg border border-line bg-surface-sunken">
        <div
          aria-hidden
          className="absolute inset-0 [background-image:linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] [background-size:40px_40px] opacity-40"
        />
        {zones.slice(0, 6).map((zone, index) => (
          <div
            key={zone.id}
            className={cn(
              "absolute rounded-full border-2 border-accent/40 bg-accent-subtle/60 px-3 py-1 label-sm text-accent",
            )}
            style={{
              left: `${10 + (index % 3) * 30}%`,
              top: `${15 + Math.floor(index / 3) * 40}%`,
            }}
          >
            {zone.label} · ×{zone.multiplier.toFixed(2)}
          </div>
        ))}
        <div className="absolute bottom-4 left-4 rounded-md bg-surface px-3 py-2 shadow-sm body-xs text-fg-subtle">
          Mapbox zones placeholder
        </div>
      </div>
      <aside className="rounded-lg border border-line bg-surface p-4 space-y-2">
        <header className="flex items-center justify-between pb-2">
          <h3 className="heading-sm text-fg">Zone multipliers</h3>
          <Chip label={`${zones.length} ZONES`} variant="neutral" />
        </header>
        <ul className="divide-y divide-line max-h-72 overflow-y-auto">
          {zones.map((zone) => (
            <li
              key={zone.id}
              className="flex items-center gap-3 py-2"
            >
              <span className="flex-1 body-sm text-fg truncate">{zone.label}</span>
              <Input
                size="sm"
                containerClassName="w-24"
                type="number"
                step="0.05"
                value={zone.multiplier}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  setZones((prev) =>
                    prev.map((z) =>
                      z.id === zone.id ? { ...z, multiplier: next } : z,
                    ),
                  )
                }}
              />
            </li>
          ))}
        </ul>
        <Button
          variant="primary"
          size="sm"
          className="w-full"
          disabled={saving}
          onClick={handleSaveZones}
        >
          {saving ? "Saving…" : "Save zones"}
        </Button>
      </aside>
    </div>
  )
}

export const PricingClient = () => (
  <div className="flex flex-col gap-6">
    <PageHeader title="Pricing" />
    <Tabs defaultValue="rates">
      <TabsList>
        <TabsTrigger value="rates">Rates</TabsTrigger>
        <TabsTrigger value="simulator">Simulator</TabsTrigger>
        <TabsTrigger value="zones">Zones</TabsTrigger>
      </TabsList>
      <TabsContent value="rates" className="pt-6">
        <RatesTab />
      </TabsContent>
      <TabsContent value="simulator" className="pt-6">
        <SimulatorTab />
      </TabsContent>
      <TabsContent value="zones" className="pt-6">
        <ZonesTab />
      </TabsContent>
    </Tabs>
  </div>
)
