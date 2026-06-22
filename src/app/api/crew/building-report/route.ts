import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token"
import { notifyAdmins } from "@/lib/notifications/dispatch"
import { matchBuildingProfile } from "@/lib/buildings/matcher"
import { buildingProfileCrewReportAdminEmailHtml } from "@/lib/email/admin-templates"
import { deriveAccessModel } from "@/lib/buildings/access-model"

type ReportEntry = {
  location?: string
  address?: string
  lat?: number | null
  lng?: number | null
  // typed access model (current crew app)
  archetype?: string | null
  building_type?: string | null
  entrance_steps_band?: string | null
  interior_levels?: number | null
  staircase_type?: string | null
  truck_spot?: string | null
  unit_floor?: number | null
  stair_type?: string | null
  stair_width_band?: string | null
  elevator_type?: string | null
  elevator_booking_required?: boolean
  elevator_window_minutes?: number | null
  coi_required?: boolean
  carry_band?: string | null
  two_stage_transfer?: boolean
  shared_with_commercial?: boolean
  lobby_walk_band?: string | null
  notes?: string
  // legacy single-question format (older crew app builds)
  elevator?: string
  commercial?: boolean
  dock?: boolean
  narrow?: boolean
  complexity?: number
}

type BuildingReportBody = {
  moveId?: string
  reports?: ReportEntry[]
  // legacy flat format
  address?: string
  lat?: number | null
  lng?: number | null
  elevator_system?: string
  has_commercial_tenants?: boolean
  loading_dock_shared_or_restricted?: boolean
  narrow_hallways?: boolean
  complexity_rating?: number
  crew_notes?: string
  photo_urls?: string[]
}

type MoveContextForBuildingReport = {
  move_code: string | null
  client_name: string | null
  from_address: string | null
  to_address: string | null
  partnerOrgName: string | null
  partnerOrgType: string | null
}

const loadMoveContextForBuildingReport = async (
  admin: ReturnType<typeof createAdminClient>,
  moveIdRaw: string,
  teamId: string,
): Promise<MoveContextForBuildingReport | null> => {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(moveIdRaw)
  const { data: m, error } = isUuid
    ? await admin
        .from("moves")
        .select("id, crew_id, move_code, client_name, from_address, to_address, organization_id")
        .eq("id", moveIdRaw)
        .single()
    : await admin
        .from("moves")
        .select("id, crew_id, move_code, client_name, from_address, to_address, organization_id")
        .ilike("move_code", String(moveIdRaw).replace(/^#/, "").toUpperCase())
        .single()

  if (error || !m || m.crew_id !== teamId) return null

  let partnerOrgName: string | null = null
  let partnerOrgType: string | null = null
  if (m.organization_id) {
    const { data: org } = await admin
      .from("organizations")
      .select("name, type")
      .eq("id", m.organization_id)
      .maybeSingle()
    if (org) {
      partnerOrgName = (org.name as string) ?? null
      partnerOrgType = (org.type as string) ?? null
    }
  }

  return {
    move_code: (m.move_code as string) ?? null,
    client_name: (m.client_name as string) ?? null,
    from_address: (m.from_address as string) ?? null,
    to_address: (m.to_address as string) ?? null,
    partnerOrgName,
    partnerOrgType,
  }
}

const shortAddressForSubject = (address: string): string => {
  const t = address.trim()
  if (t.length <= 72) return t
  return `${t.slice(0, 69)}…`
}

type SavedBuildingRow = {
  id: string
  complexity_rating: number | null
  elevator_system: string | null
  estimated_extra_minutes_per_trip: number | null
  crew_notes: string | null
  photo_urls: string[] | null
  times_moved_here: number | null
  building_type: string | null
  access_archetype: string | null
}

const sendBuildingProfileAdminNotify = async (
  isUpdate: boolean,
  address: string,
  row: SavedBuildingRow,
  accessSummaryLines: string[],
  moveCtx: MoveContextForBuildingReport | null,
) => {
  const photoCount = Array.isArray(row.photo_urls) ? row.photo_urls.length : 0
  const shortAddr = shortAddressForSubject(address)
  const subject = isUpdate
    ? `Building profile updated from crew report at ${shortAddr}`
    : `New building profile from crew report at ${shortAddr}`
  const complexity = Math.min(5, Math.max(1, Math.round(Number(row.complexity_rating) || 1)))
  const moveBit = moveCtx?.move_code ? ` Move ${moveCtx.move_code}.` : ""
  const bodyPlain = `${isUpdate ? "Updated" : "New"} building profile: ${address}. Crew complexity ${complexity} of 5.${moveBit} Open Ops to verify.`
  const html = buildingProfileCrewReportAdminEmailHtml({
    isUpdate,
    address,
    buildingProfileId: row.id,
    complexityRating: complexity,
    elevatorSystemKey: (row.elevator_system || "standard").toLowerCase(),
    estimatedExtraMinutesPerTrip: Math.round(Number(row.estimated_extra_minutes_per_trip) || 0),
    accessSummaryLines,
    buildingType: row.building_type,
    accessArchetype: row.access_archetype,
    crewNotes: row.crew_notes,
    photoCount,
    timesReportedByCrew: Math.max(1, Math.round(Number(row.times_moved_here) || 1)),
    moveCode: moveCtx?.move_code ?? null,
    clientName: moveCtx?.client_name ?? null,
    fromAddress: moveCtx?.from_address ?? null,
    toAddress: moveCtx?.to_address ?? null,
    partnerOrgName: moveCtx?.partnerOrgName ?? null,
    partnerOrgType: moveCtx?.partnerOrgType ?? null,
  })

  await notifyAdmins("building_profile_pending", {
    subject,
    body: bodyPlain,
    html,
    sourceId: row.id,
    description: bodyPlain,
  }).catch(() => {})
}

/** Legacy elevator_system value derived from the typed access model (back-compat
 *  for the engine, list badges, and email label until those are typed too). */
function legacyElevatorSystem(e: ReportEntry): string {
  const a = e.archetype
  if (a === "walk_up" || e.elevator_type === "none") return "stairs_only"
  if (a === "two_stage") return e.two_stage_transfer ? "split_transfer" : "standard"
  if (a === "elevator") return e.elevator_type === "passenger" ? "no_freight" : "standard"
  if (a === "house") return "stairs_only"
  return (e.elevator ?? "standard").toLowerCase()
}

/** Human-readable access summary lines for the coordinator email. */
function accessSummaryLines(e: ReportEntry): string[] {
  const lines: string[] = []
  if (e.archetype === "two_stage") {
    if (e.two_stage_transfer) lines.push("Two-stage transfer (P-level to lobby to residential)")
    if (e.shared_with_commercial) lines.push("Shared elevator with commercial tenants")
    if (e.lobby_walk_band === "long") lines.push("Long lobby or concourse carry")
  }
  if (e.carry_band === "long" || e.carry_band === "very_long") lines.push("Long carry from dock or elevator")
  if (e.coi_required) lines.push("COI required by building management")
  if (e.elevator_booking_required) {
    lines.push(e.elevator_window_minutes ? `Elevator booking required (${e.elevator_window_minutes} min window)` : "Elevator booking required")
  }
  if (e.archetype === "walk_up" && e.unit_floor) lines.push(`Walk-up to floor ${e.unit_floor}`)
  // legacy single-question fallback
  if (e.commercial) lines.push("Commercial or mixed-use building")
  if (e.dock) lines.push("Loading dock shared or time restricted")
  if (e.narrow) lines.push("Narrow hallways or tight turns")
  return lines
}

async function saveOneBuildingProfile(
  admin: ReturnType<typeof createAdminClient>,
  entry: ReportEntry,
  moveCtx: MoveContextForBuildingReport | null,
): Promise<{ error?: string; building?: unknown; created?: boolean }> {
  const address = (entry.address ?? "").trim()
  const lat = entry.lat ?? null
  const lng = entry.lng ?? null

  const elevator_system = legacyElevatorSystem(entry)
  const sharedCommercial = entry.shared_with_commercial ?? entry.commercial ?? false
  const freight = entry.elevator_type === "freight" || entry.elevator_type === "both"

  // Build a typed-row shape and let the model produce the engine numbers. For
  // an old single-question payload (no archetype) this falls back to the legacy
  // elevator_system mapping below.
  const typedRow = {
    access_archetype: entry.archetype ?? null,
    building_type: entry.building_type ?? null,
    elevator_system,
    has_commercial_tenants: sharedCommercial,
    elevator_shared: sharedCommercial,
    freight_elevator: freight,
    entrance_steps_band: entry.entrance_steps_band ?? null,
    interior_levels: entry.interior_levels ?? null,
    staircase_type: entry.staircase_type ?? null,
    truck_spot: entry.truck_spot ?? null,
    unit_floor: entry.unit_floor ?? null,
    stair_type: entry.stair_type ?? null,
    stair_width_band: entry.stair_width_band ?? null,
    elevator_type: entry.elevator_type ?? null,
    elevator_booking_required: entry.elevator_booking_required ?? false,
    elevator_window_minutes: entry.elevator_window_minutes ?? null,
    coi_required: entry.coi_required ?? false,
    carry_band: entry.carry_band ?? null,
    two_stage_transfer: entry.two_stage_transfer ?? false,
    lobby_walk_band: entry.lobby_walk_band ?? null,
    total_elevator_transfers: entry.two_stage_transfer ? 1 : 0,
  }

  const model = deriveAccessModel(typedRow)
  // Typed payloads compute from the model; legacy single-question payloads keep
  // the historical fixed mapping so old quotes stay stable. The model rounds to
  // one decimal place internally; the DB column is INTEGER so we round again
  // here before persist (else 3.5 errors the insert).
  const isTyped = !!entry.archetype
  const extraMinRaw = isTyped
    ? model.estimatedExtraMinutesPerTrip
    : elevator_system === "multi_transfer" ? 12
      : elevator_system === "split_transfer" ? 8
        : elevator_system === "no_freight" ? 6
          : elevator_system === "stairs_only" ? 15 : 3
  const extraMin = Math.max(0, Math.round(Number(extraMinRaw) || 0))
  const complexity = Math.min(5, Math.max(1, Math.round(isTyped ? model.complexityRating : entry.complexity ?? 3)))

  const summaryLines = accessSummaryLines(entry)
  const autoNote = summaryLines.length > 0 ? `${summaryLines.join(". ")}.` : ""
  const mergedNotes = [(entry.notes ?? "").trim(), autoNote].filter(Boolean).join("\n\n")

  // Typed columns written on both insert and update.
  const typedCols = {
    access_archetype: entry.archetype ?? null,
    entrance_steps_band: entry.entrance_steps_band ?? null,
    interior_levels: entry.interior_levels ?? null,
    staircase_type: entry.staircase_type ?? null,
    truck_spot: entry.truck_spot ?? null,
    unit_floor: entry.unit_floor ?? null,
    stair_type: entry.stair_type ?? null,
    stair_width_band: entry.stair_width_band ?? null,
    elevator_type: entry.elevator_type ?? null,
    elevator_booking_required: entry.elevator_booking_required ?? false,
    elevator_window_minutes: entry.elevator_window_minutes ?? null,
    coi_required: entry.coi_required ?? false,
    carry_band: entry.carry_band ?? null,
    two_stage_transfer: entry.two_stage_transfer ?? false,
    lobby_walk_band: entry.lobby_walk_band ?? null,
  }

  const existing = await matchBuildingProfile(admin, address, lat, lng)

  if (existing?.id) {
    const { data: updated, error } = await admin
      .from("building_profiles")
      .update({
        ...typedCols,
        building_type: entry.building_type ?? existing.building_type ?? "residential",
        elevator_system,
        complexity_rating: Math.max(complexity, existing.complexity_rating ?? 1),
        estimated_extra_minutes_per_trip: isTyped ? extraMin : Math.max(extraMin, existing.estimated_extra_minutes_per_trip ?? 0),
        freight_elevator: freight,
        has_commercial_tenants: sharedCommercial || !!existing.has_commercial_tenants,
        elevator_shared: sharedCommercial || !!existing.elevator_shared,
        crew_notes: mergedNotes || existing.crew_notes,
        verified: false,
        times_moved_here: (existing.times_moved_here ?? 0) + 1,
        last_move_date: new Date().toISOString().slice(0, 10),
        source: "crew_report",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single()

    if (error) return { error: error.message }
    if (updated) await sendBuildingProfileAdminNotify(true, address, updated as SavedBuildingRow, summaryLines, moveCtx)
    return { building: updated, created: false }
  }

  const insert = {
    ...typedCols,
    address,
    latitude: lat,
    longitude: lng,
    building_type: entry.building_type ?? "residential",
    elevator_system,
    freight_elevator: freight,
    total_elevator_transfers: entry.two_stage_transfer ? 1 : 0,
    estimated_extra_minutes_per_trip: extraMin,
    complexity_rating: complexity,
    has_commercial_tenants: sharedCommercial,
    elevator_shared: sharedCommercial,
    crew_notes: mergedNotes || null,
    source: "crew_report",
    verified: false,
    times_moved_here: 1,
    last_move_date: new Date().toISOString().slice(0, 10),
  }

  const { data: created, error: insErr } = await admin
    .from("building_profiles")
    .insert(insert)
    .select("*")
    .single()

  if (insErr) return { error: insErr.message }
  if (created) await sendBuildingProfileAdminNotify(false, address, created as SavedBuildingRow, summaryLines, moveCtx)
  return { building: created, created: true }
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value
  const payload = token ? verifyCrewToken(token) : null
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: BuildingReportBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const admin = createAdminClient()

  let moveCtx: MoveContextForBuildingReport | null = null
  if (body.moveId) {
    moveCtx = await loadMoveContextForBuildingReport(admin, body.moveId, payload.teamId)
    if (!moveCtx) return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  if (Array.isArray(body.reports) && body.reports.length > 0) {
    const results: unknown[] = []
    for (const entry of body.reports) {
      if (!((entry.address ?? "").trim().length >= 6)) continue
      const result = await saveOneBuildingProfile(admin, entry, moveCtx)
      if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
      results.push(result)
    }
    if (body.moveId) {
      await admin.from("moves").update({ building_report_submitted_at: new Date().toISOString() }).eq("id", body.moveId)
    }
    return NextResponse.json({ results })
  }

  // Legacy flat format
  const address = (body.address || "").trim()
  if (!address || address.length < 6) {
    return NextResponse.json({ error: "address is required" }, { status: 400 })
  }

  const result = await saveOneBuildingProfile(
    admin,
    {
      address,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      elevator: body.elevator_system ?? "standard",
      commercial: body.has_commercial_tenants ?? false,
      dock: body.loading_dock_shared_or_restricted ?? false,
      narrow: body.narrow_hallways ?? false,
      complexity: body.complexity_rating ?? 3,
      notes: body.crew_notes ?? "",
    },
    moveCtx,
  )
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
  if (body.moveId) {
    await admin.from("moves").update({ building_report_submitted_at: new Date().toISOString() }).eq("id", body.moveId)
  }
  return NextResponse.json(result)
}
