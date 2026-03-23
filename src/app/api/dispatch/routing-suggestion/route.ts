import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { suggestOptimalRouting } from "@/lib/scheduling/smartRouting";

export async function GET(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const date = req.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const supabase = createAdminClient();

  // Return any existing un-applied suggestion for this date (avoid re-computing)
  const { data: existing } = await supabase
    .from("routing_suggestions")
    .select("*")
    .eq("date", date)
    .eq("applied", false)
    .eq("dismissed", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const s = existing.suggestion as { text?: string; description?: string } | null;
    return NextResponse.json({
      id: existing.id,
      suggestion: s?.text ?? s?.description ?? null,
      savings_km: existing.savings_km,
      savings_minutes: existing.savings_min,
    });
  }

  // Compute via the Mapbox-based smart routing engine
  const result = await suggestOptimalRouting(date);

  if (!result) return NextResponse.json({ suggestion: null });

  // suggestOptimalRouting already persists to routing_suggestions; fetch the stored id
  const { data: stored } = await supabase
    .from("routing_suggestions")
    .select("id")
    .eq("date", date)
    .eq("applied", false)
    .eq("dismissed", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    id: stored?.id ?? null,
    suggestion: result.suggestion,
    savings_km: result.savings_km,
    savings_minutes: result.savings_minutes,
    current: result.current,
    recommended: result.recommended,
  });
}

export async function PATCH(req: NextRequest) {
  const { error: authErr2 } = await requireAdmin();
  if (authErr2) return authErr2;

  const { id, action } = await req.json();
  if (!id || !action) return NextResponse.json({ error: "Missing id/action" }, { status: 400 });

  const supabase = createAdminClient();
  await supabase
    .from("routing_suggestions")
    .update(action === "apply" ? { applied: true } : { dismissed: true })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
