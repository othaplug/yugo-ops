import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value
  const payload = token ? verifyCrewToken(token) : null
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { actual_box_count?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const count = Math.max(0, Math.round(Number(body.actual_box_count) || 0))

  const admin = createAdminClient()

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)
  const { data: m } = isUuid
    ? await admin.from("moves").select("id, crew_id").eq("id", jobId).single()
    : await admin
        .from("moves")
        .select("id, crew_id")
        .ilike("move_code", jobId.replace(/^#/, "").toUpperCase())
        .single()

  if (!m || m.crew_id !== payload.teamId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  await admin
    .from("moves")
    .update({ client_box_count: count, updated_at: new Date().toISOString() })
    .eq("id", m.id)

  return NextResponse.json({ actual_box_count: count })
}
