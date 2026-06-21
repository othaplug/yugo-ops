"use client"

import { useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import PageContent from "@/app/admin/components/PageContent"
import type { BuildingProfileRow } from "@/lib/buildings/types"
import { deriveAccessModel, accessModelTotals } from "@/lib/buildings/access-model"

type Archetype = "house" | "walk_up" | "elevator" | "two_stage"

const BUILDING_TYPES: { value: string; label: string; archetype: Archetype | null }[] = [
  { value: "detached_house", label: "Detached house", archetype: "house" },
  { value: "semi_detached", label: "Semi-detached", archetype: "house" },
  { value: "townhouse", label: "Townhouse / row", archetype: "house" },
  { value: "walk_up", label: "Walk-up apartment", archetype: "walk_up" },
  { value: "mid_rise", label: "Mid-rise (elevator)", archetype: "elevator" },
  { value: "high_rise", label: "High-rise condo", archetype: "elevator" },
  { value: "mixed_use", label: "Mixed-use / over shops", archetype: "two_stage" },
  { value: "loft_heritage", label: "Loft / heritage", archetype: "elevator" },
  { value: "commercial", label: "Commercial / office", archetype: "elevator" },
  { value: "other", label: "Other", archetype: null },
]
const LEGACY_TYPES: { value: string; label: string; archetype: Archetype | null }[] = [
  { value: "residential", label: "Residential (legacy)", archetype: "elevator" },
  { value: "condo_tower", label: "Condo tower (legacy)", archetype: "elevator" },
  { value: "low_rise", label: "Low-rise (legacy)", archetype: "elevator" },
  { value: "townhouse_complex", label: "Townhouse complex (legacy)", archetype: "house" },
]

function archetypeFor(buildingType: string): Archetype | null {
  return (
    [...BUILDING_TYPES, ...LEGACY_TYPES].find((t) => t.value === buildingType)?.archetype ?? null
  )
}

type FormState = {
  address: string
  building_name: string
  postal_code: string
  building_type: string
  total_floors: string
  management_company: string
  // house
  entrance_steps_band: string
  interior_levels: string
  staircase_type: string
  truck_spot: string
  // walk-up
  unit_floor: string
  stair_type: string
  stair_width_band: string
  // elevator / two-stage
  elevator_type: string
  elevator_booking_required: boolean
  elevator_window_minutes: string
  carry_band: string
  two_stage_transfer: boolean
  shared_with_commercial: boolean
  lobby_walk_band: string
  transfer_floors_raw: string
  // loading dock
  loading_dock: boolean
  loading_dock_location: string
  loading_dock_restrictions: string
  // scheduling / compliance
  coi_required: boolean
  coi_deposit: string
  move_hours: string
  one_move_per_day: boolean
  // commercial tenants
  commercial_tenants_raw: string
  // notes
  crew_notes: string
  coordinator_notes: string
  // override + verify
  complexity_override: number | null
  verified: boolean
}

function Seg({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(value === o.v ? "" : o.v)}
          className={`px-3 py-1.5 rounded-full text-[12px] border transition-colors ${
            value === o.v ? "bg-[#2C3E2D] border-[#2C3E2D] text-white" : "border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--tx3)]"
          }`}>{o.label}</button>
      ))}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)] mb-3">{children}</p>
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="admin-input-label">{label}</span>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

export default function BuildingEditorClient({ initial }: { initial: BuildingProfileRow | null }) {
  const router = useRouter()
  const isNew = !initial?.id
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>(() => ({
    address: String(initial?.address ?? ""),
    building_name: String(initial?.building_name ?? ""),
    postal_code: String(initial?.postal_code ?? ""),
    building_type: String(initial?.building_type ?? "high_rise"),
    total_floors: initial?.total_floors != null ? String(initial.total_floors) : "",
    management_company: String(initial?.management_company ?? ""),
    entrance_steps_band: String(initial?.entrance_steps_band ?? ""),
    interior_levels: initial?.interior_levels != null ? String(initial.interior_levels) : "",
    staircase_type: String(initial?.staircase_type ?? ""),
    truck_spot: String(initial?.truck_spot ?? ""),
    unit_floor: initial?.unit_floor != null ? String(initial.unit_floor) : "",
    stair_type: String(initial?.stair_type ?? ""),
    stair_width_band: String(initial?.stair_width_band ?? ""),
    elevator_type: String(initial?.elevator_type ?? ""),
    elevator_booking_required: !!initial?.elevator_booking_required,
    elevator_window_minutes: initial?.elevator_window_minutes != null ? String(initial.elevator_window_minutes) : "",
    carry_band: String(initial?.carry_band ?? ""),
    two_stage_transfer: !!initial?.two_stage_transfer,
    shared_with_commercial: !!(initial?.elevator_shared || initial?.has_commercial_tenants),
    lobby_walk_band: String(initial?.lobby_walk_band ?? ""),
    transfer_floors_raw: Array.isArray(initial?.transfer_floors) ? initial.transfer_floors.join(", ") : "",
    loading_dock: !!initial?.loading_dock,
    loading_dock_location: String(initial?.loading_dock_location ?? ""),
    loading_dock_restrictions: String(initial?.loading_dock_restrictions ?? ""),
    coi_required: !!initial?.coi_required,
    coi_deposit: initial?.coi_deposit != null ? String(initial.coi_deposit) : "",
    move_hours: String(initial?.move_hours ?? ""),
    one_move_per_day: !!initial?.one_move_per_day,
    commercial_tenants_raw: Array.isArray(initial?.commercial_tenants) ? initial.commercial_tenants.join(", ") : "",
    crew_notes: String(initial?.crew_notes ?? ""),
    coordinator_notes: String(initial?.coordinator_notes ?? ""),
    complexity_override: null,
    verified: !!initial?.verified,
  }))

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value })), [])
  const handleText = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(key, e.target.value as never)
  const handleCheck = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.checked as never)

  const archetype = archetypeFor(form.building_type)

  const legacyElevatorSystem = (): string => {
    if (archetype === "walk_up" || form.elevator_type === "none") return "stairs_only"
    if (archetype === "two_stage") return form.two_stage_transfer ? "split_transfer" : "standard"
    if (archetype === "elevator") return form.elevator_type === "passenger" ? "no_freight" : "standard"
    if (archetype === "house") return "stairs_only"
    return "standard"
  }

  const modelRow = useMemo(() => ({
    access_archetype: archetype,
    building_type: form.building_type,
    elevator_system: legacyElevatorSystem(),
    has_commercial_tenants: form.shared_with_commercial,
    elevator_shared: form.shared_with_commercial,
    freight_elevator: form.elevator_type === "freight" || form.elevator_type === "both",
    entrance_steps_band: form.entrance_steps_band || null,
    interior_levels: form.interior_levels ? Number(form.interior_levels) : null,
    staircase_type: form.staircase_type || null,
    truck_spot: form.truck_spot || null,
    unit_floor: form.unit_floor ? Number(form.unit_floor) : null,
    stair_type: form.stair_type || null,
    stair_width_band: form.stair_width_band || null,
    elevator_type: form.elevator_type || null,
    elevator_booking_required: form.elevator_booking_required,
    elevator_window_minutes: form.elevator_window_minutes ? Number(form.elevator_window_minutes) : null,
    coi_required: form.coi_required,
    coi_deposit: form.coi_deposit ? Number(form.coi_deposit) : null,
    carry_band: form.carry_band || null,
    two_stage_transfer: form.two_stage_transfer,
    lobby_walk_band: form.lobby_walk_band || null,
    one_move_per_day: form.one_move_per_day,
    move_hours: form.move_hours || null,
    total_elevator_transfers: form.two_stage_transfer ? 1 : 0,
  }), [form, archetype]) // eslint-disable-line react-hooks/exhaustive-deps

  const model = useMemo(() => deriveAccessModel(modelRow), [modelRow])
  const totals = useMemo(() => accessModelTotals(model, 60), [model])
  const effectiveComplexity = form.complexity_override ?? model.complexityRating

  const handleSave = useCallback(async () => {
    setSaving(true)
    setErr(null)
    try {
      const list = (raw: string) => raw.split(",").map((s) => s.trim()).filter(Boolean)
      const payload: Record<string, unknown> = {
        address: form.address.trim(),
        building_name: form.building_name.trim() || null,
        postal_code: form.postal_code.trim() || null,
        building_type: form.building_type,
        access_archetype: archetype,
        total_floors: form.total_floors ? Number(form.total_floors) : null,
        management_company: form.management_company.trim() || null,
        elevator_system: legacyElevatorSystem(),
        freight_elevator: form.elevator_type === "freight" || form.elevator_type === "both",
        entrance_steps_band: form.entrance_steps_band || null,
        interior_levels: form.interior_levels ? Number(form.interior_levels) : null,
        staircase_type: form.staircase_type || null,
        truck_spot: form.truck_spot || null,
        unit_floor: form.unit_floor ? Number(form.unit_floor) : null,
        stair_type: form.stair_type || null,
        stair_width_band: form.stair_width_band || null,
        elevator_type: form.elevator_type || null,
        elevator_booking_required: form.elevator_booking_required,
        elevator_window_minutes: form.elevator_window_minutes ? Number(form.elevator_window_minutes) : null,
        carry_band: form.carry_band || null,
        two_stage_transfer: form.two_stage_transfer,
        lobby_walk_band: form.lobby_walk_band || null,
        transfer_floors: list(form.transfer_floors_raw),
        loading_dock: form.loading_dock,
        loading_dock_location: form.loading_dock_location.trim() || null,
        loading_dock_restrictions: form.loading_dock_restrictions.trim() || null,
        coi_required: form.coi_required,
        coi_deposit: form.coi_deposit ? Number(form.coi_deposit) : null,
        move_hours: form.move_hours.trim() || null,
        one_move_per_day: form.one_move_per_day,
        has_commercial_tenants: form.shared_with_commercial,
        elevator_shared: form.shared_with_commercial,
        commercial_tenants: list(form.commercial_tenants_raw),
        estimated_extra_minutes_per_trip: model.estimatedExtraMinutesPerTrip,
        complexity_rating: effectiveComplexity,
        crew_notes: form.crew_notes.trim() || null,
        coordinator_notes: form.coordinator_notes.trim() || null,
        verified: form.verified,
        verified_at: form.verified ? (initial?.verified_at ?? new Date().toISOString()) : null,
      }
      const url = isNew ? "/api/admin/buildings" : `/api/admin/buildings/${String(initial?.id)}`
      const res = await fetch(url, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) { setErr(typeof data.error === "string" ? data.error : "Save failed"); return }
      if (isNew && data.building?.id) router.replace(`/admin/buildings/${data.building.id}`)
      else router.refresh()
    } catch {
      setErr("Save failed")
    } finally {
      setSaving(false)
    }
  }, [form, archetype, model.estimatedExtraMinutesPerTrip, effectiveComplexity, isNew, initial?.id, initial?.verified_at, router]) // eslint-disable-line react-hooks/exhaustive-deps

  const isElevator = archetype === "elevator" || archetype === "two_stage"

  return (
    <PageContent>
      <div className="w-full min-w-0 pb-12">
        <Link href="/admin/buildings" className="inline-block text-[12px] text-[var(--tx3)] hover:text-[var(--tx)] mb-5">&larr; Buildings</Link>
        <h1 className="text-[22px] font-semibold text-[var(--tx)] tracking-tight [font-family:var(--font-body)] mb-6">{isNew ? "Add building" : "Edit building"}</h1>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0 space-y-8">

            <section>
              <SectionLabel>Identity</SectionLabel>
              <div className="space-y-3">
                <div>
                  <span className="admin-input-label">Address *</span>
                  <input value={form.address} onChange={handleText("address")} placeholder="Full street address including city and province" className="admin-input" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="admin-input-label">Building name</span><input value={form.building_name} onChange={handleText("building_name")} placeholder="e.g. The Lakeshore Residence" className="admin-input" /></div>
                  <div><span className="admin-input-label">Postal code</span><input value={form.postal_code} onChange={handleText("postal_code")} placeholder="M5A 1B2" className="admin-input" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="admin-input-label">Building type</span>
                    <select value={form.building_type} onChange={handleText("building_type")} className="admin-select">
                      {BUILDING_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      {LEGACY_TYPES.some((l) => l.value === form.building_type) && LEGACY_TYPES.filter((l) => l.value === form.building_type).map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </div>
                  <div><span className="admin-input-label">Total floors</span><input type="number" min={1} value={form.total_floors} onChange={handleText("total_floors")} placeholder="e.g. 35" className="admin-input" /></div>
                </div>
                <div><span className="admin-input-label">Management company</span><input value={form.management_company} onChange={handleText("management_company")} placeholder="e.g. Greenwin Corp" className="admin-input" /></div>
              </div>
            </section>

            <section>
              <SectionLabel>Access {archetype ? `· ${archetype.replace("_", " ")}` : ""}</SectionLabel>
              <div className="space-y-4">
                {archetype === "house" && (
                  <>
                    <Row label="Steps to the front door"><Seg value={form.entrance_steps_band} onChange={(v) => set("entrance_steps_band", v)} options={[{ v: "none", label: "None" }, { v: "few", label: "A few" }, { v: "porch", label: "Porch" }, { v: "many", label: "10+" }]} /></Row>
                    <Row label="Interior levels we'll cover"><Seg value={form.interior_levels} onChange={(v) => set("interior_levels", v)} options={[{ v: "1", label: "Main only" }, { v: "2", label: "2" }, { v: "3", label: "3+" }, { v: "4", label: "+ basement" }]} /></Row>
                    <Row label="Interior staircase"><Seg value={form.staircase_type} onChange={(v) => set("staircase_type", v)} options={[{ v: "open", label: "Open" }, { v: "narrow", label: "Narrow" }, { v: "tight_turn", label: "Tight turn" }, { v: "spiral", label: "Spiral" }]} /></Row>
                    <Row label="Truck spot"><Seg value={form.truck_spot} onChange={(v) => set("truck_spot", v)} options={[{ v: "driveway", label: "Driveway" }, { v: "street", label: "Street" }, { v: "far", label: "Far / laneway" }]} /></Row>
                  </>
                )}
                {archetype === "walk_up" && (
                  <>
                    <Row label="Unit floor"><Seg value={form.unit_floor} onChange={(v) => set("unit_floor", v)} options={[{ v: "2", label: "2" }, { v: "3", label: "3" }, { v: "4", label: "4" }, { v: "5", label: "5+" }]} /></Row>
                    <Row label="Stair type"><Seg value={form.stair_type} onChange={(v) => set("stair_type", v)} options={[{ v: "straight", label: "Straight" }, { v: "switchback", label: "Switchback" }, { v: "spiral", label: "Spiral" }, { v: "exterior", label: "Exterior" }]} /></Row>
                    <Row label="Stair width & turns"><Seg value={form.stair_width_band} onChange={(v) => set("stair_width_band", v)} options={[{ v: "roomy", label: "Roomy" }, { v: "standard", label: "Standard" }, { v: "tight", label: "Tight" }]} /></Row>
                    <Row label="Entrance steps"><Seg value={form.entrance_steps_band} onChange={(v) => set("entrance_steps_band", v)} options={[{ v: "none", label: "None" }, { v: "few", label: "Stoop" }, { v: "many", label: "Many" }]} /></Row>
                  </>
                )}
                {isElevator && (
                  <>
                    {archetype === "two_stage" && <div className="text-[12px] text-[#6B1F3A] bg-[#6B1F3A]/8 rounded-lg px-3 py-2">Two-stage building — double-handling expected.</div>}
                    <Row label="Elevator for the move"><Seg value={form.elevator_type} onChange={(v) => set("elevator_type", v)} options={[{ v: "freight", label: "Freight" }, { v: "passenger", label: "Passenger only" }, { v: "both", label: "Both" }, { v: "none", label: "None" }]} /></Row>
                    <div className="grid grid-cols-2 gap-3">
                      <div><span className="admin-input-label">Unit floor</span><input type="number" min={1} value={form.unit_floor} onChange={handleText("unit_floor")} placeholder="e.g. 18" className="admin-input" /></div>
                      <Row label="Carry: dock → elevator → unit"><Seg value={form.carry_band} onChange={(v) => set("carry_band", v)} options={[{ v: "short", label: "Short" }, { v: "medium", label: "Med" }, { v: "long", label: "Long" }, { v: "very_long", label: "V. long" }]} /></Row>
                    </div>
                    {archetype === "two_stage" && (
                      <>
                        <label className="flex items-center gap-2 text-[13px] text-[var(--tx)] cursor-pointer"><input type="checkbox" checked={form.shared_with_commercial} onChange={handleCheck("shared_with_commercial")} /> Shared elevator with stores below</label>
                        <label className="flex items-center gap-2 text-[13px] text-[var(--tx)] cursor-pointer"><input type="checkbox" checked={form.two_stage_transfer} onChange={handleCheck("two_stage_transfer")} /> Two-stage transfer (P-level → lobby → residential)</label>
                        <Row label="Lobby / concourse walk"><Seg value={form.lobby_walk_band} onChange={(v) => set("lobby_walk_band", v)} options={[{ v: "short", label: "Short" }, { v: "medium", label: "Medium" }, { v: "long", label: "Long" }]} /></Row>
                        <div><span className="admin-input-label">Transfer floor(s)</span><input value={form.transfer_floors_raw} onChange={handleText("transfer_floors_raw")} placeholder="e.g. P1, Lobby" className="admin-input" /></div>
                      </>
                    )}
                  </>
                )}
                {!archetype && <p className="text-[12px] text-[var(--tx3)]">Pick a building type to capture access details.</p>}
              </div>
            </section>

            {isElevator && (
              <section>
                <SectionLabel>Scheduling & compliance</SectionLabel>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-5">
                    <label className="flex items-center gap-2 text-[13px] text-[var(--tx)] cursor-pointer"><input type="checkbox" checked={form.elevator_booking_required} onChange={handleCheck("elevator_booking_required")} /> Elevator booking required</label>
                    <label className="flex items-center gap-2 text-[13px] text-[var(--tx)] cursor-pointer"><input type="checkbox" checked={form.coi_required} onChange={handleCheck("coi_required")} /> COI required</label>
                    <label className="flex items-center gap-2 text-[13px] text-[var(--tx)] cursor-pointer"><input type="checkbox" checked={form.one_move_per_day} onChange={handleCheck("one_move_per_day")} /> One move per day</label>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {form.elevator_booking_required && <div><span className="admin-input-label">Window (min)</span><input type="number" min={0} value={form.elevator_window_minutes} onChange={handleText("elevator_window_minutes")} placeholder="120" className="admin-input" /></div>}
                    {form.coi_required && <div><span className="admin-input-label">Deposit ($)</span><input type="number" min={0} value={form.coi_deposit} onChange={handleText("coi_deposit")} placeholder="300" className="admin-input" /></div>}
                    <div><span className="admin-input-label">Move hours</span><input value={form.move_hours} onChange={handleText("move_hours")} placeholder="9–4 wkdy" className="admin-input" /></div>
                  </div>
                  <label className="flex items-center gap-2 text-[13px] text-[var(--tx)] cursor-pointer"><input type="checkbox" checked={form.loading_dock} onChange={handleCheck("loading_dock")} /> Has loading dock</label>
                  {form.loading_dock && (
                    <div className="grid grid-cols-2 gap-3">
                      <div><span className="admin-input-label">Dock location</span><input value={form.loading_dock_location} onChange={handleText("loading_dock_location")} placeholder="e.g. P1, east ramp" className="admin-input" /></div>
                      <div><span className="admin-input-label">Dock restrictions</span><input value={form.loading_dock_restrictions} onChange={handleText("loading_dock_restrictions")} placeholder="Shared, weekdays only" className="admin-input" /></div>
                    </div>
                  )}
                  {form.shared_with_commercial && <div><span className="admin-input-label">Commercial tenants</span><input value={form.commercial_tenants_raw} onChange={handleText("commercial_tenants_raw")} placeholder="e.g. Longo's, Shoppers" className="admin-input" /></div>}
                </div>
              </section>
            )}

            <section>
              <SectionLabel>Notes</SectionLabel>
              <div className="space-y-3">
                <div><span className="admin-input-label">Crew notes</span><span className="block text-[10px] text-[var(--tx3)] mb-1">Visible to crew on move day</span><textarea value={form.crew_notes} onChange={handleText("crew_notes")} rows={3} placeholder="e.g. Freight at P2, transfer at lobby. Fob from concierge." className="admin-textarea" /></div>
                <div><span className="admin-input-label">Coordinator notes</span><span className="block text-[10px] text-[var(--tx3)] mb-1">Internal only</span><textarea value={form.coordinator_notes} onChange={handleText("coordinator_notes")} rows={2} placeholder="e.g. Last 3BR ran ~9 hrs." className="admin-textarea" /></div>
              </div>
            </section>

            <section>
              <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-[var(--brd)] bg-[var(--surface)]">
                <div>
                  <label className="flex items-center gap-2 text-[13px] font-semibold text-[var(--tx)] cursor-pointer"><input type="checkbox" checked={form.verified} onChange={handleCheck("verified")} /> Mark as verified</label>
                  <p className="text-[11px] text-[var(--tx3)] ml-5 mt-0.5">Verified buildings are shown with confidence in quote alerts.</p>
                </div>
                {initial?.source && <span className="text-[11px] text-[var(--tx3)] shrink-0">Source: {initial.source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>}
              </div>
            </section>
          </div>

          <aside className="lg:w-[300px] shrink-0">
            <div className="rounded-xl border border-[#CDDAC6] bg-[#EFF3EC] p-4 lg:sticky lg:top-4">
              <p className="text-[12px] font-semibold text-[#2C3E2D] mb-1">Access time model</p>
              <p className="text-[11px] text-[#5A6B5E] mb-3">Computed from the fields — updates as you edit.</p>
              {model.drivers.length === 0 ? (
                <p className="text-[12px] text-[#5A6B5E]">No access penalty captured yet.</p>
              ) : (
                <div className="space-y-1.5 mb-3">
                  {totals.drivers.map((d) => (
                    <div key={d.key} className="flex items-baseline justify-between gap-2 text-[12px] text-[#3A443A] pb-1.5 border-b border-[#DCE6D7]">
                      <span>{d.label}</span><span className="text-[#2C3E2D] whitespace-nowrap">+{d.minutesPerTrip} /trip</span>
                    </div>
                  ))}
                  <div className="flex items-baseline justify-between gap-2 pt-1 text-[#2C3E2D]"><span className="text-[12px]">Typical home (~60 trips)</span><span className="text-[15px]">≈ {(totals.totalExtraMinutes / 60).toFixed(1)} hrs</span></div>
                </div>
              )}
              <div className="flex gap-2 mb-3">
                <div className="flex-1 bg-white border border-[#CDDAC6] rounded-lg px-2.5 py-2">
                  <div className="text-[10px] text-[#7E8C79]">Complexity</div>
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={() => set("complexity_override", n === model.complexityRating ? null : n)} className={`w-6 h-6 rounded text-[11px] border ${effectiveComplexity === n ? "bg-[#2C3E2D] text-white border-[#2C3E2D]" : "border-[#CDDAC6] text-[#7E8C79]"}`}>{n}</button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 bg-white border border-[#CDDAC6] rounded-lg px-2.5 py-2"><div className="text-[10px] text-[#7E8C79]">Per trip</div><div className="text-[15px] text-[#2C3E2D] mt-0.5">+{model.estimatedExtraMinutesPerTrip} min</div></div>
              </div>
              {form.complexity_override != null && <p className="text-[11px] text-[#8A5A1E] mb-2">Override active (computed {model.complexityRating}). <button type="button" className="underline" onClick={() => set("complexity_override", null)}>reset</button></p>}
              {model.schedulingFlags.length > 0 && (
                <>
                  <p className="text-[11px] text-[#5A6B5E] mb-1.5">Ops flags on the move</p>
                  <div className="space-y-1.5">
                    {model.schedulingFlags.map((f) => <div key={f.key} className="text-[12px] text-[#3A443A] bg-white border border-[#DCE6D7] rounded-lg px-2.5 py-1.5">{f.label}</div>)}
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>

        {err && <p className="admin-field-helper admin-field-helper--error mt-4">{err}</p>}

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--brd)]">
          <Link href="/admin/buildings" className="text-[12px] text-[var(--tx3)] hover:text-[var(--tx)]">Cancel</Link>
          <button type="button" onClick={handleSave} disabled={saving || !form.address.trim()} className="inline-flex items-center justify-center h-9 px-5 rounded-[var(--yu3-r-md)] bg-[var(--yu3-wine)] text-[var(--yu3-on-wine)] text-[13px] font-semibold hover:bg-[var(--yu3-wine-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{saving ? "Saving…" : isNew ? "Add building" : "Save changes"}</button>
        </div>
      </div>
    </PageContent>
  )
}
