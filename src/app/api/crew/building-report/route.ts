import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token"
import { notifyAdmins } from "@/lib/notifications/dispatch"
import { matchBuildingProfile } from "@/lib/buildings/matcher"

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value
  const payload = token ? verifyCrewToken(token) : null
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: {
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
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    body.moveId || "",
  )
  if (body.moveId) {
    const { data: m } = isUuid
      ? await admin.from("moves").select("id, crew_id, move_code").eq("id", body.moveId).single()
      : await admin
          .from("moves")
          .select("id, crew_id, move_code")
          .ilike("move_code", String(body.moveId).replace(/^#/, "").toUpperCase())
          .single()
    if (!m || m.crew_id !== payload.teamId) {
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

    await notifyAdmins("building_profile_pending", {
      subject: "Building profile updated from crew report",
      body: `${address}: review verification (${updated?.complexity_rating ?? complexity}/5).`,
      sourceId: updated?.id,
      description: `Crew update for ${address}`,
    }).catch(() => {})

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

  await notifyAdmins("building_profile_pending", {
    subject: "New building profile from crew report",
    body: `${address}: pending verification.`,
    sourceId: created?.id,
    description: `New building report: ${address}`,
  }).catch(() => {})

  return NextResponse.json({ building: created, created: true })
}
