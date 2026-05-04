import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token"
import { notifyAdmins } from "@/lib/notifications/dispatch"
import { matchBuildingProfile } from "@/lib/buildings/matcher"
import { buildingProfileCrewReportAdminEmailHtml } from "@/lib/email/admin-templates"

type BuildingReportBody = {
  moveId?: string
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
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    moveIdRaw,
  )
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

const accessSummaryLinesFromReportBody = (b: BuildingReportBody): string[] => {
  const lines: string[] = []
  if (b.has_commercial_tenants) {
    lines.push("Commercial or mixed-use building (crew noted shared elevator context)")
  }
  if (b.loading_dock_shared_or_restricted) {
    lines.push("Loading dock shared or time restricted")
  }
  if (b.narrow_hallways) {
    lines.push("Narrow hallways or tight turns")
  }
  return lines
}

const shortAddressForSubject = (address: string): string => {
  const t = address.trim()
  if (t.length <= 72) return t
  return `${t.slice(0, 69)}\u2026`
}

type SavedBuildingRow = {
  id: string
  complexity_rating: number | null
  elevator_system: string | null
  estimated_extra_minutes_per_trip: number | null
  crew_notes: string | null
  photo_urls: string[] | null
  times_moved_here: number | null
}

const sendBuildingProfileAdminNotify = async (
  isUpdate: boolean,
  address: string,
  row: SavedBuildingRow,
  reportBody: BuildingReportBody,
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
    accessSummaryLines: accessSummaryLinesFromReportBody(reportBody),
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

  const address = (body.address || "").trim()
  if (!address || address.length < 6) {
    return NextResponse.json({ error: "address is required" }, { status: 400 })
  }

  const admin = createAdminClient()

  let moveCtx: MoveContextForBuildingReport | null = null
  if (body.moveId) {
    moveCtx = await loadMoveContextForBuildingReport(admin, body.moveId, payload.teamId)
    if (!moveCtx) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }
  }

  const elevator_system = (body.elevator_system || "standard").toLowerCase()
  const complexity = Math.min(5, Math.max(1, Math.round(Number(body.complexity_rating) || 3)))
  const extraMin =
    elevator_system === "multi_transfer"
      ? 12
      : elevator_system === "split_transfer"
        ? 8
        : elevator_system === "no_freight"
          ? 6
          : elevator_system === "stairs_only"
            ? 15
            : 3

  const existing = await matchBuildingProfile(admin, address, body.lat ?? null, body.lng ?? null)

  const photo_urls = Array.isArray(body.photo_urls)
    ? body.photo_urls.filter((u) => typeof u === "string" && u.trim()).slice(0, 8)
    : []

  const notesParts: string[] = []
  if (body.loading_dock_shared_or_restricted) notesParts.push("Loading dock shared or time restricted")
  if (body.narrow_hallways) notesParts.push("Narrow hallways or tight turns")
  const autoNote = notesParts.length > 0 ? `${notesParts.join(". ")}.` : ""
  const mergedNotes = [body.crew_notes?.trim(), autoNote].filter(Boolean).join("\n\n")

  if (existing?.id) {
    const { data: updated, error } = await admin
      .from("building_profiles")
      .update({
        elevator_system,
        complexity_rating: Math.max(complexity, existing.complexity_rating ?? 1),
        estimated_extra_minutes_per_trip: Math.max(
          extraMin,
          existing.estimated_extra_minutes_per_trip ?? 0,
        ),
        has_commercial_tenants:
          !!body.has_commercial_tenants || !!existing.has_commercial_tenants,
        crew_notes: mergedNotes || existing.crew_notes,
        photo_urls: photo_urls.length > 0 ? photo_urls : existing.photo_urls,
        verified: false,
        times_moved_here: (existing.times_moved_here ?? 0) + 1,
        last_move_date: new Date().toISOString().slice(0, 10),
        source: "crew_report",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (updated) {
      await sendBuildingProfileAdminNotify(true, address, updated as SavedBuildingRow, body, moveCtx)
    }

    return NextResponse.json({ building: updated, created: false })
  }

  const insert = {
    address,
    postal_code: null as string | null,
    building_name: null as string | null,
    latitude: body.lat ?? null,
    longitude: body.lng ?? null,
    building_type: "residential",
    elevator_system,
    freight_elevator: elevator_system !== "stairs_only" && elevator_system !== "no_freight",
    total_elevator_transfers:
      elevator_system === "multi_transfer" ? 2 : elevator_system === "split_transfer" ? 1 : 0,
    estimated_extra_minutes_per_trip: extraMin,
    complexity_rating: complexity,
    has_commercial_tenants: !!body.has_commercial_tenants,
    elevator_shared: !!body.has_commercial_tenants,
    loading_dock_restrictions: body.loading_dock_shared_or_restricted
      ? "Shared or restricted dock access reported by crew"
      : null,
    crew_notes: mergedNotes || null,
    photo_urls: photo_urls.length > 0 ? photo_urls : null,
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

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  if (created) {
    await sendBuildingProfileAdminNotify(false, address, created as SavedBuildingRow, body, moveCtx)
  }

  return NextResponse.json({ building: created, created: true })
}
