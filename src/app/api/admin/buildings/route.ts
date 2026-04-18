import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaff } from "@/lib/api-auth"

export async function GET(req: NextRequest) {
  const { error: authErr } = await requireStaff()
  if (authErr) return authErr

  const q = req.nextUrl.searchParams.get("q")?.trim() || ""
  const sb = createAdminClient()

  if (q.length >= 2) {
    const needle = `%${q.replace(/%/g, "").slice(0, 80)}%`
    const [{ data: byAddr, error: e1 }, { data: byName, error: e2 }] = await Promise.all([
      sb.from("building_profiles").select("*").ilike("address", needle).limit(120),
      sb.from("building_profiles").select("*").ilike("building_name", needle).limit(120),
    ])
    const err = e1 || e2
    if (err) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
    const map = new Map<string, Record<string, unknown>>()
    for (const row of [...(byAddr ?? []), ...(byName ?? [])]) {
      map.set((row as { id: string }).id, row as Record<string, unknown>)
    }
    const buildings = [...map.values()].sort((a, b) => {
      const ca = Number(a.complexity_rating) || 0
      const cb = Number(b.complexity_rating) || 0
      if (cb !== ca) return cb - ca
      return String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? ""))
    })
    return NextResponse.json({ buildings })
  }

  const { data, error } = await sb
    .from("building_profiles")
    .select("*")
    .order("complexity_rating", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(200)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ buildings: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireStaff()
  if (authErr) return authErr

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const address = String(body.address || "").trim()
  if (!address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 })
  }

  const sb = createAdminClient()
  const insert = {
    address,
    postal_code: body.postal_code ? String(body.postal_code) : null,
    building_name: body.building_name ? String(body.building_name) : null,
    management_company: body.management_company ? String(body.management_company) : null,
    latitude: body.latitude != null ? Number(body.latitude) : null,
    longitude: body.longitude != null ? Number(body.longitude) : null,
    building_type: body.building_type ? String(body.building_type) : "residential",
    elevator_system: body.elevator_system ? String(body.elevator_system) : "standard",
    freight_elevator: !!body.freight_elevator,
    freight_elevator_location: body.freight_elevator_location ? String(body.freight_elevator_location) : null,
    residential_elevator_location: body.residential_elevator_location
      ? String(body.residential_elevator_location)
      : null,
    transfer_floors: Array.isArray(body.transfer_floors) ? body.transfer_floors : null,
    total_elevator_transfers:
      body.total_elevator_transfers != null ? Number(body.total_elevator_transfers) : 0,
    estimated_extra_minutes_per_trip:
      body.estimated_extra_minutes_per_trip != null
        ? Number(body.estimated_extra_minutes_per_trip)
        : 0,
    complexity_rating: body.complexity_rating != null ? Number(body.complexity_rating) : 1,
    loading_dock: !!body.loading_dock,
    loading_dock_location: body.loading_dock_location ? String(body.loading_dock_location) : null,
    loading_dock_restrictions: body.loading_dock_restrictions
      ? String(body.loading_dock_restrictions)
      : null,
    loading_dock_booking_required: !!body.loading_dock_booking_required,
    has_commercial_tenants: !!body.has_commercial_tenants,
    commercial_tenants: Array.isArray(body.commercial_tenants) ? body.commercial_tenants : null,
    move_hours: body.move_hours ? String(body.move_hours) : null,
    elevator_booking_required: body.elevator_booking_required !== false,
    elevator_max_hours: body.elevator_max_hours != null ? Number(body.elevator_max_hours) : null,
    elevator_shared: !!body.elevator_shared,
    hallway_width: body.hallway_width ? String(body.hallway_width) : null,
    doorway_dimensions: body.doorway_dimensions ? String(body.doorway_dimensions) : null,
    max_item_length: body.max_item_length ? String(body.max_item_length) : null,
    freight_elevator_dimensions: body.freight_elevator_dimensions
      ? String(body.freight_elevator_dimensions)
      : null,
    parking_type: body.parking_type ? String(body.parking_type) : null,
    parking_notes: body.parking_notes ? String(body.parking_notes) : null,
    total_floors: body.total_floors != null ? Number(body.total_floors) : null,
    total_units: body.total_units != null ? Number(body.total_units) : null,
    residential_floors: body.residential_floors ? String(body.residential_floors) : null,
    commercial_floors: body.commercial_floors ? String(body.commercial_floors) : null,
    crew_notes: body.crew_notes ? String(body.crew_notes) : null,
    coordinator_notes: body.coordinator_notes ? String(body.coordinator_notes) : null,
    photo_urls: Array.isArray(body.photo_urls) ? body.photo_urls : null,
    source: body.source ? String(body.source) : "coordinator_visit",
    verified: !!body.verified,
    verified_at: body.verified ? new Date().toISOString() : null,
    verified_by: body.verified_by ? String(body.verified_by) : null,
  }

  const { data, error } = await sb.from("building_profiles").insert(insert).select("*").single()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ building: data })
}
