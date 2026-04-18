import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaff } from "@/lib/api-auth"
import { matchBuildingProfile } from "@/lib/buildings/matcher"

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireStaff()
  if (authErr) return authErr

  let body: { address?: string; lat?: number | null; lng?: number | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const address = (body.address || "").trim()
  if (address.length < 6) {
    return NextResponse.json({ profile: null })
  }

  const sb = createAdminClient()
  const profile = await matchBuildingProfile(
    sb,
    address,
    body.lat ?? null,
    body.lng ?? null,
  )

  return NextResponse.json({ profile })
}
