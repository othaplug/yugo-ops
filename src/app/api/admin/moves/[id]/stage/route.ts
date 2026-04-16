import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { computeOperationalJobAlerts } from "@/lib/jobs/operational-alerts";
import { estimateDurationFromMoveRow } from "@/lib/jobs/duration-estimate";
import { maybeNotifyOperationalInJobAlerts } from "@/lib/jobs/operational-alert-notifications";
import { isMoveIdUuid } from "@/lib/move-code";
import { pickLatestTrackingSession } from "@/lib/move-status";

/** GET move stage/status for live polling. Staff only. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireStaff();
  if (error) return error;

  const rawSlug = (await params).id?.trim() || "";
  const admin = createAdminClient();
  const byUuid = isMoveIdUuid(rawSlug);
  const { data, error: fetchErr } = await (byUuid
    ? admin
        .from("moves")
        // Select `*` so this route stays compatible when DB schema lags behind repo migrations.
        // The caller only needs a subset of these fields, and missing columns should not break polling.
        .select("*")
        .eq("id", rawSlug)
        .single()
    : admin
        .from("moves")
        // Select `*` so this route stays compatible when DB schema lags behind repo migrations.
        .select("*")
        .ilike("move_code", rawSlug.replace(/^#/, "").toUpperCase())
        .single());

  if (fetchErr || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const id = (data as { id: string }).id;

  const st = (data.status || "").toLowerCase();
  const terminal = st === "completed" || st === "cancelled" || st === "delivered";
  if (!terminal) {
    const { data: sessionRows } = await admin
      .from("tracking_sessions")
      .select("status, completed_at, created_at, updated_at, started_at, is_active")
      .eq("job_id", id)
      .eq("job_type", "move");
    const best = pickLatestTrackingSession(sessionRows || []);
    const bestRow = best as { status?: string; completed_at?: string | null } | null;
    const sessionCompleted =
      !!bestRow &&
      ((bestRow.status || "").toLowerCase() === "completed" || !!bestRow.completed_at);
    if (sessionCompleted) {
      return NextResponse.json(
        {
          ...data,
          status: "completed",
          stage: "completed",
          completed_at: bestRow!.completed_at ?? data.completed_at,
          operationalAlerts: null,
        },
        { headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    }
  }

  let operationalAlerts = null;
  if (!terminal) {
    const row = data as Record<string, unknown>;
    let allocated: number | null =
      row.estimated_duration_minutes != null &&
      Number.isFinite(Number(row.estimated_duration_minutes)) &&
      Number(row.estimated_duration_minutes) > 0
        ? Math.round(Number(row.estimated_duration_minutes))
        : null;
    if (allocated == null) {
      const dEst = estimateDurationFromMoveRow(row);
      if (dEst) allocated = dEst.totalMinutes;
    }

    const { data: activeSess } = await admin
      .from("tracking_sessions")
      .select("status, started_at")
      .eq("job_id", id)
      .eq("job_type", "move")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let elapsedMin: number | null = null;
    if (activeSess?.started_at) {
      elapsedMin =
        (Date.now() - new Date(String(activeSess.started_at)).getTime()) /
        60000;
    }

    const gross = Number(row.estimate ?? row.amount ?? 0);
    const intCostRaw = row.estimated_internal_cost;
    let intCost =
      intCostRaw != null && Number.isFinite(Number(intCostRaw))
        ? Number(intCostRaw)
        : null;
    if (intCost == null) {
      const dFallback = estimateDurationFromMoveRow(row);
      if (dFallback) intCost = dFallback.estimatedCost;
    }

    operationalAlerts = computeOperationalJobAlerts({
      jobType: "move",
      grossRevenue: gross,
      estimatedInternalCost: intCost,
      allocatedMinutes: allocated,
      elapsedMinutes: elapsedMin,
      trackingStatus: activeSess?.status
        ? String(activeSess.status)
        : String((data as { stage?: string }).stage || ""),
    });

    const clientLabel = String((data as { client_name?: string | null }).client_name || "").trim() || "Customer";
    void maybeNotifyOperationalInJobAlerts({
      jobType: "move",
      jobId: id,
      clientLabel,
      alerts: operationalAlerts,
    });
  }

  return NextResponse.json(
    { ...data, operationalAlerts },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
