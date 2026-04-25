import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/api-auth"

/**
 * Admin-only: inspect how tracking session `job_id` values resolve to moves/deliveries
 * for a crew. Uses `team_id` on `tracking_sessions` (same as crew analytics API).
 *
 * GET /api/admin/crew-analytics/debug/[crewId]?limit=10
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ crewId: string }> },
) {
  const { error: authErr } = await requireAdmin()
  if (authErr) return authErr

  const { crewId } = await params
  if (!crewId) return NextResponse.json({ error: "crewId required" }, { status: 400 })

  const limit = Math.min(50, Math.max(1, Number(new URL(_req.url).searchParams.get("limit")) || 10))

  const sb = createAdminClient()

  const { data: sessions, error: sessErr } = await sb
    .from("tracking_sessions")
    .select("id, job_id, job_type, started_at, completed_at, status")
    .eq("team_id", crewId)
    .order("started_at", { ascending: false })
    .limit(limit)

  if (sessErr) {
    return NextResponse.json(
      { error: "Session query failed", detail: sessErr.message },
      { status: 500 },
    )
  }

  const rows = sessions || []
  const diagnostics = await Promise.all(
    rows.map(async (session) => {
      const jobId = session.job_id as string | null
      const result: Record<string, unknown> = {
        session_id: session.id,
        job_id: jobId,
        job_type: session.job_type,
        status: session.status,
        started_at: session.started_at,
        completed_at: session.completed_at,
      }

      if (!jobId) {
        result.resolution = "NO_JOB_ID"
        return result
      }

      const { data: moveById } = await sb
        .from("moves")
        .select("id, client_name, quote_id, move_code")
        .eq("id", jobId)
        .maybeSingle()

      const { data: moveByQuote } = await sb
        .from("moves")
        .select("id, client_name, quote_id, move_code")
        .eq("quote_id", jobId)
        .maybeSingle()

      const { data: moveByCode } = await sb
        .from("moves")
        .select("id, client_name, quote_id, move_code")
        .eq("move_code", jobId)
        .maybeSingle()

      const { data: dlvById } = await sb
        .from("deliveries")
        .select("id, client_name, customer_name, business_name, delivery_number, source_quote_id")
        .eq("id", jobId)
        .maybeSingle()

      const { data: dlvByQuote } = await sb
        .from("deliveries")
        .select("id, client_name, customer_name, business_name, delivery_number, source_quote_id")
        .eq("source_quote_id", jobId)
        .maybeSingle()

      const { data: dlvByNumber } = await sb
        .from("deliveries")
        .select("id, client_name, customer_name, business_name, delivery_number, source_quote_id")
        .eq("delivery_number", jobId)
        .maybeSingle()

      const mLabel = (m: { client_name?: string | null } | null) =>
        m ? String(m.client_name || "").trim() || "(no client_name on move)" : null

      const dLabel = (
        d: {
          client_name?: string | null
          customer_name?: string | null
          business_name?: string | null
        } | null,
      ) => {
        if (!d) return null
        return (
          String(d.customer_name || d.client_name || d.business_name || "").trim() ||
          "(no name on delivery)"
        )
      }

      result.move_by_id = mLabel(moveById)
      result.move_by_quote_id = mLabel(moveByQuote)
      result.move_by_move_code = mLabel(moveByCode)
      result.delivery_by_id = dLabel(dlvById)
      result.delivery_by_source_quote = dLabel(dlvByQuote)
      result.delivery_by_number = dLabel(dlvByNumber)

      const resolvedName = moveById
        ? mLabel(moveById)
        : moveByQuote
          ? mLabel(moveByQuote)
          : moveByCode
            ? mLabel(moveByCode)
            : dlvById
              ? dLabel(dlvById)
              : dlvByQuote
                ? dLabel(dlvByQuote)
                : dlvByNumber
                  ? dLabel(dlvByNumber)
                  : "UNRESOLVED"

      result.resolved_name = resolvedName

      const resolutionMethod = moveById
        ? "moves.id"
        : moveByQuote
          ? "moves.quote_id"
          : moveByCode
            ? "moves.move_code"
            : dlvById
              ? "deliveries.id"
              : dlvByQuote
                ? "deliveries.source_quote_id"
                : dlvByNumber
                  ? "deliveries.delivery_number"
                  : "NONE"

      result.resolution_method = resolutionMethod
      return result
    }),
  )

  const dList = diagnostics as Array<{ resolution_method?: string }>
  const resolution_methods = dList.reduce<Record<string, number>>((acc, d) => {
    const k = d.resolution_method || "unknown"
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    crew_id: crewId,
    note: "Sessions filtered by team_id. Each session runs individual lookups (debug only).",
    total_sessions: rows.length,
    diagnostics,
    summary: {
      resolved: dList.filter((d) => d.resolution_method && d.resolution_method !== "NONE").length,
      unresolved: dList.filter((d) => d.resolution_method === "NONE").length,
      resolution_methods,
    },
  })
}
