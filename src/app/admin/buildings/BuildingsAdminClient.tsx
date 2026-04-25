"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { CaretDown, CaretUp } from "@phosphor-icons/react"
import { PageHeader } from "@/design-system/admin/layout"
import { KpiStrip } from "@/design-system/admin/dashboard"
import { Button, SearchInput, Select, StatusPill, Badge } from "@/design-system/admin/primitives"
import type { BuildingProfileRow } from "@/lib/buildings/types"
import BackButton from "../components/BackButton"

const ELEVATOR_LABELS: Record<string, string> = {
  standard: "Standard (direct to floor)",
  split_transfer: "Split transfer",
  multi_transfer: "Multiple transfers",
  no_freight: "No freight elevator",
  stairs_only: "Stairs only",
}

const BUILDING_TYPE_LABELS: Record<string, string> = {
  residential: "Residential",
  mixed_use: "Mixed-use",
  commercial: "Commercial",
  condo_tower: "Condo tower",
  low_rise: "Low-rise",
  townhouse_complex: "Townhouse complex",
}

const SOURCE_LABELS: Record<string, string> = {
  coordinator_visit: "Coordinator visit",
  crew_report: "Crew report",
  client_provided: "Client provided",
  admin_entry: "Admin entry",
  unknown: "Unknown",
}

const fmtDate = (s: string | null | undefined): string => {
  if (!s) return "Never"
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

// Use white on solid status fills. Do not use --yu3-ink-inverse: in dark mode it
// switches to a dark value meant for type on light UI, so digits vanish on red/green.
const complexityPillClass = (rating: number | null): string => {
  const r = rating ?? 1
  if (r >= 4) {
    return "bg-[var(--yu3-danger)] text-white"
  }
  if (r >= 3) {
    return "bg-[var(--yu3-warning)] text-white"
  }
  return "bg-[var(--yu3-success)] text-white"
}

const complexityLabel = (rating: number | null): string => {
  const r = rating ?? 1
  if (r >= 4) return "High"
  if (r >= 3) return "Med"
  return "Low"
}

function BuildingCard({
  building,
  onVerified,
}: {
  building: BuildingProfileRow
  onVerified: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const handleVerify = useCallback(async () => {
    setVerifying(true)
    try {
      await fetch(`/api/admin/buildings/${building.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified: true }),
      })
      onVerified(building.id)
    } catch {
      /* non-fatal */
    } finally {
      setVerifying(false)
    }
  }, [building.id, onVerified])

  const rating = building.complexity_rating ?? 1

  return (
    <div className="rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] overflow-hidden">
      <div className="px-4 py-3.5 flex items-start gap-4">
        <div className="flex flex-col items-center gap-1 shrink-0 w-10">
          <div
            className={`w-10 h-10 rounded-[var(--yu3-r-md)] flex items-center justify-center font-bold text-base tabular-nums ${complexityPillClass(building.complexity_rating)}`}
          >
            {rating}
          </div>
          <span className="text-[9px] text-[var(--yu3-ink-muted)] uppercase tracking-wide font-semibold">
            {complexityLabel(building.complexity_rating)}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-semibold text-[var(--yu3-ink-strong)] truncate">
              {building.building_name || building.address}
            </p>
            {building.verified ? (
              <StatusPill tone="success">Verified</StatusPill>
            ) : (
              <StatusPill tone="warning">Unverified</StatusPill>
            )}
          </div>

          {building.building_name && (
            <p className="text-[12px] text-[var(--yu3-ink-muted)] mt-0.5 truncate">
              {building.address}
            </p>
          )}

          <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-[var(--yu3-ink-muted)]">
            {building.elevator_system && (
              <span>
                {ELEVATOR_LABELS[building.elevator_system] ??
                  building.elevator_system}
              </span>
            )}
            {(building.total_elevator_transfers ?? 0) > 0 && (
              <span>
                {building.total_elevator_transfers} elevator transfer
                {building.total_elevator_transfers !== 1 ? "s" : ""}
              </span>
            )}
            {(building.estimated_extra_minutes_per_trip ?? 0) > 0 && (
              <span>+{building.estimated_extra_minutes_per_trip} min/trip</span>
            )}
            {building.has_commercial_tenants && (
              <span className="text-[var(--yu3-warning)] font-medium">
                Commercial tenants
              </span>
            )}
            {building.loading_dock && <span>Loading dock</span>}
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-[13px] font-semibold text-[var(--yu3-ink-strong)] tabular-nums">
            {building.times_moved_here ?? 0} moves
          </p>
          <p className="text-[11px] text-[var(--yu3-ink-muted)] mt-0.5">
            {building.last_move_date
              ? `Last ${fmtDate(building.last_move_date)}`
              : "No moves logged"}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((x) => !x)}
            className="flex items-center gap-1 text-[11px] text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-ink)] px-2 py-1 rounded-[var(--yu3-r-sm)] transition-colors"
            aria-label={
              expanded ? "Collapse building details" : "Expand building details"
            }
          >
            {expanded ? <CaretUp size={12} /> : <CaretDown size={12} />}
            {expanded ? "Less" : "More"}
          </button>
          <Link
            href={`/admin/buildings/${building.id}`}
            className="text-[11px] font-semibold text-[var(--yu3-ink)] hover:text-[var(--yu3-ink-strong)] px-2 py-1 rounded-[var(--yu3-r-sm)] transition-colors"
          >
            Edit
          </Link>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface-subtle)] px-4 py-4">
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <p className="yu3-t-eyebrow text-[var(--yu3-ink-muted)] mb-2">
                Access details
              </p>
              <div className="space-y-1.5 text-[12px]">
                <Row
                  label="Elevator"
                  value={
                    ELEVATOR_LABELS[building.elevator_system ?? ""] ??
                    building.elevator_system
                  }
                />
                {building.freight_elevator_location && (
                  <Row
                    label="Freight location"
                    value={building.freight_elevator_location}
                  />
                )}
                {(building.transfer_floors?.length ?? 0) > 0 && (
                  <Row
                    label="Transfer floors"
                    value={building.transfer_floors!.join(" \u2192 ")}
                  />
                )}
                <Row
                  label="Loading dock"
                  value={building.loading_dock ? "Yes" : "No"}
                />
                {building.loading_dock_restrictions && (
                  <Row
                    label="Dock restrictions"
                    value={building.loading_dock_restrictions}
                  />
                )}
                {building.move_hours && (
                  <Row label="Move hours" value={building.move_hours} />
                )}
                {building.elevator_booking_required && (
                  <Row label="Elevator booking" value="Required" />
                )}
              </div>
            </div>

            <div>
              <p className="yu3-t-eyebrow text-[var(--yu3-ink-muted)] mb-2">
                Building info
              </p>
              <div className="space-y-1.5 text-[12px]">
                {building.building_type && (
                  <Row
                    label="Type"
                    value={
                      BUILDING_TYPE_LABELS[building.building_type] ??
                      building.building_type
                    }
                  />
                )}
                {building.total_floors && (
                  <Row label="Floors" value={String(building.total_floors)} />
                )}
                {building.management_company && (
                  <Row label="Management" value={building.management_company} />
                )}
                {building.parking_type && (
                  <Row
                    label="Parking"
                    value={building.parking_type.replace(/_/g, " ")}
                  />
                )}
                {building.has_commercial_tenants &&
                  (building.commercial_tenants?.length ?? 0) > 0 && (
                    <div>
                      <span className="text-[var(--yu3-ink-muted)]">
                        Commercial tenants
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {building.commercial_tenants!.map((t, i) => (
                          <Badge key={i} variant="warning" size="sm">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>

            <div>
              <p className="yu3-t-eyebrow text-[var(--yu3-ink-muted)] mb-2">
                Impact and notes
              </p>
              <div className="space-y-1.5 text-[12px] mb-3">
                <Row
                  label="Extra time per trip"
                  value={
                    (building.estimated_extra_minutes_per_trip ?? 0) > 0
                      ? `+${building.estimated_extra_minutes_per_trip} min`
                      : "None"
                  }
                  highlight={
                    (building.estimated_extra_minutes_per_trip ?? 0) > 0
                  }
                />
                <Row
                  label="Source"
                  value={
                    SOURCE_LABELS[building.source ?? ""] ??
                    building.source ??
                    "Unknown"
                  }
                />
                {building.verified && building.verified_by && (
                  <Row label="Verified by" value={building.verified_by} />
                )}
              </div>

              {building.crew_notes && (
                <NoteBox label="Crew notes" text={building.crew_notes} />
              )}
              {building.coordinator_notes && (
                <NoteBox
                  label="Coordinator notes"
                  text={building.coordinator_notes}
                  className="mt-2"
                />
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {!building.verified && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleVerify}
                disabled={verifying}
              >
                {verifying ? "Saving…" : "Mark as verified"}
              </Button>
            )}
            <Button variant="secondary" size="sm" asChild>
              <Link
                href={`/admin/moves?q=${encodeURIComponent(building.address)}`}
              >
                View move history
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/admin/buildings/${building.id}`}>
                Edit building
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string
  value: string | null | undefined
  highlight?: boolean
}) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[var(--yu3-ink-muted)] shrink-0">{label}</span>
      <span
        className={`text-right ${highlight ? "font-semibold text-[var(--yu3-warning)]" : "text-[var(--yu3-ink)]"}`}
      >
        {value}
      </span>
    </div>
  )
}

function NoteBox({
  label,
  text,
  className = "",
}: {
  label: string
  text: string
  className?: string
}) {
  return (
    <div
      className={`p-2.5 bg-[var(--yu3-bg-surface)] rounded-[var(--yu3-r-md)] border border-[var(--yu3-line)] ${className}`}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--yu3-ink-muted)] mb-1">
        {label}
      </p>
      <p className="text-[11px] text-[var(--yu3-ink)] leading-relaxed">{text}</p>
    </div>
  )
}

export default function BuildingsAdminClient({
  initial,
}: {
  initial: BuildingProfileRow[]
}) {
  const [search, setSearch] = useState("")
  const [complexityFilter, setComplexityFilter] = useState("")
  const [verifiedFilter, setVerifiedFilter] = useState("")
  const [rows, setRows] = useState<BuildingProfileRow[]>(initial)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const u = new URL("/api/admin/buildings", window.location.origin)
      if (query.trim().length >= 2) u.searchParams.set("q", query.trim())
      const res = await fetch(u.toString())
      const data = await res.json()
      if (Array.isArray(data.buildings))
        setRows(data.buildings as BuildingProfileRow[])
    } catch {
      /* keep list */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => void load(search), 320)
    return () => window.clearTimeout(t)
  }, [search, load])

  const handleVerified = useCallback((id: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, verified: true, verified_at: new Date().toISOString() }
          : r,
      ),
    )
  }, [])

  const filtered = rows.filter((b) => {
    if (complexityFilter === "high" && (b.complexity_rating ?? 1) < 4)
      return false
    if (complexityFilter === "medium" && (b.complexity_rating ?? 1) !== 3)
      return false
    if (complexityFilter === "low" && (b.complexity_rating ?? 1) > 2)
      return false
    if (verifiedFilter === "verified" && !b.verified) return false
    if (verifiedFilter === "unverified" && b.verified) return false
    return true
  })

  const totalBuildings = rows.length
  const highComplexity = rows.filter(
    (b) => (b.complexity_rating ?? 1) >= 4,
  ).length
  const verifiedCount = rows.filter((b) => b.verified).length
  const unverifiedCount = rows.filter((b) => !b.verified).length

  const kpiTiles = useMemo(
    () => [
      {
        id: "total",
        label: "Total",
        value: String(totalBuildings),
        hint: "Buildings cataloged",
      },
      {
        id: "complex",
        label: "Complex",
        value: String(highComplexity),
        hint: "Rated 4 or 5",
        valueClassName: "text-rose-800 dark:text-rose-300",
      },
      {
        id: "verified",
        label: "Verified",
        value: String(verifiedCount),
        hint: "Confirmed by crew",
        valueClassName: "text-emerald-800 dark:text-emerald-300",
      },
      {
        id: "unverified",
        label: "Unverified",
        value: String(unverifiedCount),
        hint: "Pending review",
        valueClassName: "text-amber-800 dark:text-amber-200",
      },
    ],
    [totalBuildings, highComplexity, verifiedCount, unverifiedCount],
  )

  return (
    <div
      className="w-full min-w-0 flex flex-col gap-6 py-1 animate-fade-up"
      aria-busy={loading}
    >
      <div>
        <BackButton
          label="Back"
          variant="v2"
          className="text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-ink)]"
        />
      </div>

      <PageHeader
        eyebrow="Operations"
        title="Buildings"
        description="Access intelligence for quoting accuracy and crew planning."
        actions={
          <Button asChild variant="primary" size="sm">
            <Link href="/admin/buildings/new">Add building</Link>
          </Button>
        }
      />

      <KpiStrip tiles={kpiTiles} columns={4} variant="pills" />

      <section className="min-w-0" aria-labelledby="buildings-list-heading">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-3">
          <h2
            id="buildings-list-heading"
            className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]"
          >
            Catalog
          </h2>
          {loading && (
            <span className="text-[11px] text-[var(--yu3-ink-muted)] sm:text-right">
              Updating results…
            </span>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
              placeholder="Search address, building name, or postal code"
            />
          </div>
          <Select
            value={complexityFilter}
            onChange={(e) => setComplexityFilter(e.target.value)}
            className="w-full sm:w-[min(100%,200px)] shrink-0"
            aria-label="Filter by complexity"
          >
            <option value="">All complexity</option>
            <option value="high">High (4-5)</option>
            <option value="medium">Medium (3)</option>
            <option value="low">Low (1-2)</option>
          </Select>
          <Select
            value={verifiedFilter}
            onChange={(e) => setVerifiedFilter(e.target.value)}
            className="w-full sm:w-[min(100%,200px)] shrink-0"
            aria-label="Filter by verification status"
          >
            <option value="">All status</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </Select>
        </div>

        <div className="space-y-2">
          {filtered.map((b) => (
            <BuildingCard key={b.id} building={b} onVerified={handleVerified} />
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12 rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)]">
              <p className="text-[13px] text-[var(--yu3-ink)]">
                {search || complexityFilter || verifiedFilter
                  ? "No buildings match your filters."
                  : "No buildings cataloged yet."}
              </p>
              <p className="text-[11px] text-[var(--yu3-ink-muted)] mt-1 max-w-md mx-auto">
                Buildings are added from crew reports, coordinator entries, or
                manually.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
