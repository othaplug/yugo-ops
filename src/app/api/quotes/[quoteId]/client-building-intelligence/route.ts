import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Client answers about building access (public quote page).
 * Merges into factors_applied.client_building_intelligence on the quote row.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const { quoteId } = await params
  const id = (quoteId || "").trim()
  if (!id) return NextResponse.json({ error: "Invalid quote" }, { status: 400 })

  let body: {
    token?: string
    stores_on_lower_floors?: boolean
    above_20th_floor?: boolean
    older_or_small_elevators?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const token = (body.token || "").trim()
  if (!token) return NextResponse.json({ error: "Invalid" }, { status: 403 })

  const sb = createAdminClient()
  const { data: quote, error: qErr } = await sb
    .from("quotes")
    .select("id, quote_id, public_action_token, status, factors_applied")
    .eq("quote_id", id)
    .single()

  if (qErr || !quote) {
    return NextResponse.json({ error: "Invalid" }, { status: 403 })
  }

  const stored = (quote as { public_action_token?: string | null }).public_action_token?.trim()
  if (!stored || stored !== token) {
    return NextResponse.json({ error: "Invalid" }, { status: 403 })
  }

  const st = ((quote as { status?: string }).status || "").toLowerCase()
  if (st === "accepted" || st === "declined" || st === "lost" || st === "superseded") {
    return NextResponse.json({ error: "Quote is not editable" }, { status: 409 })
  }

  const prev = (quote as { factors_applied?: Record<string, unknown> | null }).factors_applied ?? {}
  const nextFactors = {
    ...prev,
    client_building_intelligence: {
      stores_on_lower_floors: !!body.stores_on_lower_floors,
      above_20th_floor: !!body.above_20th_floor,
      older_or_small_elevators: !!body.older_or_small_elevators,
      recorded_at: new Date().toISOString(),
    },
  }

  const { error: upErr } = await sb
    .from("quotes")
    .update({
      factors_applied: nextFactors,
      updated_at: new Date().toISOString(),
    })
    .eq("id", (quote as { id: string }).id)

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
