"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import PageContent from "@/app/admin/components/PageContent"
import type { BuildingProfileRow } from "@/lib/buildings/types"

type FormState = {
  // Location
  address: string
  building_name: string
  postal_code: string
  building_type: string
  total_floors: string
  management_company: string
  // Elevator and access
  elevator_system: string
  total_elevator_transfers: string
  freight_elevator_location: string
  transfer_floors_raw: string // comma-separated
  estimated_extra_minutes_per_trip: string
  complexity_rating: number
  elevator_booking_required: boolean
  elevator_shared: boolean
  // Loading dock
  loading_dock: boolean
  loading_dock_location: string
  loading_dock_restrictions: string
  move_hours: string
  // Commercial tenants
  has_commercial_tenants: boolean
  commercial_tenants_raw: string // comma-separated
  // Notes
  crew_notes: string
  coordinator_notes: string
  // Verification
  verified: boolean
}

const BUILDING_TYPES = [
  { value: "residential", label: "Residential" },
  { value: "condo_tower", label: "Condo tower" },
  { value: "low_rise", label: "Low-rise" },
  { value: "mixed_use", label: "Mixed-use (residential and commercial)" },
  { value: "commercial", label: "Commercial" },
  { value: "townhouse_complex", label: "Townhouse complex" },
]

const ELEVATOR_SYSTEMS = [
  { value: "standard", label: "Standard (direct to floor)" },
  { value: "split_transfer", label: "Split transfer (freight to residential)" },
  { value: "multi_transfer", label: "Multiple transfers" },
  { value: "no_freight", label: "No freight elevator" },
  { value: "stairs_only", label: "Stairs only" },
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)] mb-3">
      {children}
    </p>
  )
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="admin-input-label">{children}</span>
      {hint && <span className="block text-[10px] text-[var(--tx3)] mt-0.5 mb-1">{hint}</span>}
    </label>
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
    building_type: String(initial?.building_type ?? "residential"),
    total_floors: initial?.total_floors != null ? String(initial.total_floors) : "",
    management_company: String(initial?.management_company ?? ""),
    elevator_system: String(initial?.elevator_system ?? "standard"),
    total_elevator_transfers: String(initial?.total_elevator_transfers ?? 0),
    freight_elevator_location: String(initial?.freight_elevator_location ?? ""),
    transfer_floors_raw: Array.isArray(initial?.transfer_floors)
      ? initial.transfer_floors.join(", ")
      : "",
    estimated_extra_minutes_per_trip: String(initial?.estimated_extra_minutes_per_trip ?? 0),
    complexity_rating: Number(initial?.complexity_rating ?? 3),
    elevator_booking_required: !!initial?.elevator_booking_required,
    elevator_shared: !!initial?.elevator_shared,
    loading_dock: !!initial?.loading_dock,
    loading_dock_location: String(initial?.loading_dock_location ?? ""),
    loading_dock_restrictions: String(initial?.loading_dock_restrictions ?? ""),
    move_hours: String(initial?.move_hours ?? ""),
    has_commercial_tenants: !!initial?.has_commercial_tenants,
    commercial_tenants_raw: Array.isArray(initial?.commercial_tenants)
      ? initial.commercial_tenants.join(", ")
      : "",
    crew_notes: String(initial?.crew_notes ?? ""),
    coordinator_notes: String(initial?.coordinator_notes ?? ""),
    verified: !!initial?.verified,
  }))

  const set = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((f) => ({ ...f, [key]: value }))
    },
    [],
  )

  const handleText =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      set(key, e.target.value as never)
    }

  const handleCheck =
    (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      set(key, e.target.checked as never)
    }

  const handleSave = useCallback(async () => {
    setSaving(true)
    setErr(null)
    try {
      const parseFloors = (raw: string): string[] =>
        raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)

      const payload: Record<string, unknown> = {
        address: form.address.trim(),
        building_name: form.building_name.trim() || null,
        postal_code: form.postal_code.trim() || null,
        building_type: form.building_type,
        total_floors: form.total_floors ? Number(form.total_floors) : null,
        management_company: form.management_company.trim() || null,
        elevator_system: form.elevator_system,
        total_elevator_transfers: Number(form.total_elevator_transfers) || 0,
        freight_elevator_location: form.freight_elevator_location.trim() || null,
        transfer_floors: parseFloors(form.transfer_floors_raw),
        estimated_extra_minutes_per_trip: Number(form.estimated_extra_minutes_per_trip) || 0,
        complexity_rating: form.complexity_rating,
        elevator_booking_required: form.elevator_booking_required,
        elevator_shared: form.elevator_shared,
        loading_dock: form.loading_dock,
        loading_dock_location: form.loading_dock_location.trim() || null,
        loading_dock_restrictions: form.loading_dock_restrictions.trim() || null,
        move_hours: form.move_hours.trim() || null,
        has_commercial_tenants: form.has_commercial_tenants,
        commercial_tenants: parseFloors(form.commercial_tenants_raw),
        crew_notes: form.crew_notes.trim() || null,
        coordinator_notes: form.coordinator_notes.trim() || null,
        verified: form.verified,
        verified_at: form.verified ? (initial?.verified_at ?? new Date().toISOString()) : null,
      }

      const url = isNew ? "/api/admin/buildings" : `/api/admin/buildings/${String(initial?.id)}`
      const method = isNew ? "POST" : "PATCH"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setErr(typeof data.error === "string" ? data.error : "Save failed")
        return
      }
      if (isNew && data.building?.id) {
        router.replace(`/admin/buildings/${data.building.id}`)
      } else {
        router.refresh()
      }
    } catch {
      setErr("Save failed")
    } finally {
      setSaving(false)
    }
  }, [form, isNew, initial?.id, initial?.verified_at, router])

  const needsTransferDetails =
    form.elevator_system === "split_transfer" || form.elevator_system === "multi_transfer"

  return (
    <PageContent>
      <div className="w-full min-w-0 pb-12">
        <Link
          href="/admin/buildings"
          className="inline-block text-[12px] text-[var(--tx3)] hover:text-[var(--tx)] mb-5"
        >
          &larr; Buildings
        </Link>

        <h1 className="text-[22px] font-semibold text-[var(--tx)] tracking-tight [font-family:var(--font-body)] mb-6">
          {isNew ? "Add building" : "Edit building"}
        </h1>

        <div className="space-y-8">
          {/* Section 1: Location */}
          <section>
            <SectionLabel>Location</SectionLabel>
            <div className="space-y-3">
              <div>
                <span className="admin-input-label">Address *</span>
                <input
                  value={form.address}
                  onChange={handleText("address")}
                  placeholder="Full street address including city and province"
                  className="admin-input"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="admin-input-label">Building name (optional)</span>
                  <input
                    value={form.building_name}
                    onChange={handleText("building_name")}
                    placeholder="e.g. The Lakeshore Residence"
                    className="admin-input"
                  />
                </div>
                <div>
                  <span className="admin-input-label">Postal code</span>
                  <input
                    value={form.postal_code}
                    onChange={handleText("postal_code")}
                    placeholder="M5A 1B2"
                    className="admin-input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="admin-input-label">Building type</span>
                  <select
                    value={form.building_type}
                    onChange={handleText("building_type")}
                    className="admin-select"
                  >
                    {BUILDING_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="admin-input-label">Total floors</span>
                  <input
                    type="number"
                    min={1}
                    value={form.total_floors}
                    onChange={handleText("total_floors")}
                    placeholder="e.g. 35"
                    className="admin-input"
                  />
                </div>
              </div>
              <div>
                <span className="admin-input-label">Management company (optional)</span>
                <input
                  value={form.management_company}
                  onChange={handleText("management_company")}
                  placeholder="e.g. Greenwin Corp"
                  className="admin-input"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Elevator and access */}
          <section>
            <SectionLabel>Elevator and access</SectionLabel>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="admin-input-label">Elevator system</span>
                  <select
                    value={form.elevator_system}
                    onChange={handleText("elevator_system")}
                    className="admin-select"
                  >
                    {ELEVATOR_SYSTEMS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="admin-input-label">Elevator transfers (count)</span>
                  <input
                    type="number"
                    min={0}
                    max={6}
                    value={form.total_elevator_transfers}
                    onChange={handleText("total_elevator_transfers")}
                    className="admin-input"
                  />
                </div>
              </div>

              {needsTransferDetails && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                  <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">
                    Transfer details
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="admin-input-label text-amber-700">Freight elevator location</span>
                      <input
                        value={form.freight_elevator_location}
                        onChange={handleText("freight_elevator_location")}
                        placeholder="e.g. P1 loading dock"
                        className="admin-input bg-white border-amber-300"
                      />
                    </div>
                    <div>
                      <span className="admin-input-label text-amber-700">Transfer floor(s)</span>
                      <input
                        value={form.transfer_floors_raw}
                        onChange={handleText("transfer_floors_raw")}
                        placeholder="e.g. P1, Lobby, 3"
                        className="admin-input bg-white border-amber-300"
                      />
                      <span className="text-[10px] text-amber-600 mt-0.5 block">Comma-separated</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="admin-input-label">Extra time per trip (minutes)</span>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={form.estimated_extra_minutes_per_trip}
                    onChange={handleText("estimated_extra_minutes_per_trip")}
                    className="admin-input"
                  />
                  <span className="text-[10px] text-[var(--tx3)] mt-0.5 block">
                    Added minutes vs a standard building, per trip.
                  </span>
                </div>
                <div>
                  <span className="admin-input-label">Complexity rating (1 to 5)</span>
                  <div className="flex gap-1.5 mt-1">
                    {[1, 2, 3, 4, 5].map((n) => {
                      const active = form.complexity_rating === n
                      const color = n >= 4 ? "red" : n >= 3 ? "amber" : "green"
                      const activeClass =
                        color === "red"
                          ? "bg-red-500 text-white border-red-500"
                          : color === "amber"
                            ? "bg-amber-500 text-white border-amber-500"
                            : "bg-green-500 text-white border-green-500"
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => set("complexity_rating", n)}
                          className={`w-10 h-10 rounded-lg text-[13px] border font-semibold transition-all ${
                            active ? activeClass : "border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--tx3)]"
                          }`}
                        >
                          {n}
                        </button>
                      )
                    })}
                  </div>
                  <span className="text-[10px] text-[var(--tx3)] mt-1 block">
                    1 = easy, 3 = some issues, 5 = extreme difficulty
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2 text-[13px] text-[var(--tx)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.elevator_booking_required}
                    onChange={handleCheck("elevator_booking_required")}
                  />
                  Elevator booking required
                </label>
                <label className="flex items-center gap-2 text-[13px] text-[var(--tx)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.elevator_shared}
                    onChange={handleCheck("elevator_shared")}
                  />
                  Shared elevator with commercial
                </label>
              </div>
            </div>
          </section>

          {/* Section 3: Loading dock and parking */}
          <section>
            <SectionLabel>Loading dock and parking</SectionLabel>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[13px] text-[var(--tx)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.loading_dock}
                  onChange={handleCheck("loading_dock")}
                />
                Has loading dock
              </label>

              {form.loading_dock && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="admin-input-label">Dock location</span>
                    <input
                      value={form.loading_dock_location}
                      onChange={handleText("loading_dock_location")}
                      placeholder="e.g. P1 via ramp on east side"
                      className="admin-input"
                    />
                  </div>
                  <div>
                    <span className="admin-input-label">Dock restrictions</span>
                    <input
                      value={form.loading_dock_restrictions}
                      onChange={handleText("loading_dock_restrictions")}
                      placeholder="e.g. Shared, max 2 hrs, weekdays only"
                      className="admin-input"
                    />
                  </div>
                </div>
              )}

              <div>
                <span className="admin-input-label">Move hours</span>
                <input
                  value={form.move_hours}
                  onChange={handleText("move_hours")}
                  placeholder="e.g. 8 AM to 5 PM weekdays, 9 AM to 4 PM weekends"
                  className="admin-input"
                />
              </div>
            </div>
          </section>

          {/* Section 4: Commercial tenants */}
          <section>
            <SectionLabel>Commercial tenants</SectionLabel>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[13px] text-[var(--tx)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.has_commercial_tenants}
                  onChange={handleCheck("has_commercial_tenants")}
                />
                Building has commercial tenants (stores, restaurants, offices)
              </label>

              {form.has_commercial_tenants && (
                <div>
                  <FieldLabel hint="Comma-separated">Tenant names</FieldLabel>
                  <input
                    value={form.commercial_tenants_raw}
                    onChange={handleText("commercial_tenants_raw")}
                    placeholder="e.g. Longo's, Tim Hortons, Shoppers Drug Mart"
                    className="admin-input"
                  />
                </div>
              )}
            </div>
          </section>

          {/* Section 5: Notes */}
          <section>
            <SectionLabel>Notes</SectionLabel>
            <div className="space-y-3">
              <div>
                <FieldLabel hint="Visible to crew on move day">Crew notes</FieldLabel>
                <textarea
                  value={form.crew_notes}
                  onChange={handleText("crew_notes")}
                  rows={3}
                  placeholder="e.g. Freight elevator at P2, transfer at lobby to south tower. Ask concierge for fob. Allow 10 min per trip."
                  className="admin-textarea"
                />
              </div>
              <div>
                <FieldLabel hint="Internal only — not shown to crew or clients">
                  Coordinator notes
                </FieldLabel>
                <textarea
                  value={form.coordinator_notes}
                  onChange={handleText("coordinator_notes")}
                  rows={3}
                  placeholder="e.g. Always quote 2 extra hours. Last crew reported 12 hr unload on a 3BR."
                  className="admin-textarea"
                />
              </div>
            </div>
          </section>

          {/* Section 6: Verification */}
          <section>
            <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-[var(--brd)] bg-[var(--surface)]">
              <div>
                <label className="flex items-center gap-2 text-[13px] font-semibold text-[var(--tx)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.verified}
                    onChange={handleCheck("verified")}
                  />
                  Mark as verified
                </label>
                <p className="text-[11px] text-[var(--tx3)] ml-5 mt-0.5">
                  Verified buildings are shown with confidence in quote alerts and complexity flags.
                </p>
              </div>
              {initial?.source && (
                <span className="text-[11px] text-[var(--tx3)] shrink-0">
                  Source:{" "}
                  {initial.source
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              )}
            </div>
          </section>
        </div>

        {err && (
          <p className="admin-field-helper admin-field-helper--error mt-4">{err}</p>
        )}

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--brd)]">
          <Link
            href="/admin/buildings"
            className="text-[12px] text-[var(--tx3)] hover:text-[var(--tx)]"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !form.address.trim()}
            className="inline-flex items-center justify-center h-9 px-5 rounded-[var(--yu3-r-md)] bg-[var(--yu3-wine)] text-[var(--yu3-on-wine)] text-[13px] font-semibold hover:bg-[var(--yu3-wine-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--yu3-wine)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving…" : isNew ? "Add building" : "Save changes"}
          </button>
        </div>
      </div>
    </PageContent>
  )
}
