import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

/**
 * PATCH /api/admin/profitability/[jobId]/costs
 * Upsert per-job cost overrides into job_cost_overrides.
 * Body: { job_type: "move"|"delivery", labour?, fuel?, truck?, supplies?, processing? }
 * Any field set to null removes that override (falls back to calculated value).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { jobId } = await params;
  const body = await req.json();
  const { job_type, labour, fuel, truck, supplies, processing } = body as {
    job_type: "move" | "delivery";
    labour?: number | null;
    fuel?: number | null;
    truck?: number | null;
    supplies?: number | null;
    processing?: number | null;
  };

  if (!job_type || !["move", "delivery"].includes(job_type)) {
    return NextResponse.json({ error: "job_type must be 'move' or 'delivery'" }, { status: 400 });
  }

  const sb = createAdminClient();

  const payload: Record<string, unknown> = {
    job_id: jobId,
    job_type,
    updated_at: new Date().toISOString(),
  };
  if (labour !== undefined) payload.labour = labour;
  if (fuel !== undefined) payload.fuel = fuel;
  if (truck !== undefined) payload.truck = truck;
  if (supplies !== undefined) payload.supplies = supplies;
  if (processing !== undefined) payload.processing = processing;

  const { data, error } = await sb
    .from("job_cost_overrides")
    .upsert(payload, { onConflict: "job_id,job_type" })
    .select()
    .single();

  if (error) {
    console.error("[profitability costs] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ override: data });
}

/**
 * GET /api/admin/profitability/[jobId]/costs
 * Return the current override for a single job (if any).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { jobId } = await params;
  const sb = createAdminClient();

  const { data } = await sb
    .from("job_cost_overrides")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle();

  return NextResponse.json({ override: data ?? null });
}
