import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const { quoteId } = await params;
  const body = (await req.json().catch(() => ({}))) as { scenario_id?: string; token?: string };
  const scenarioId = body.scenario_id?.trim();
  const token = body.token?.trim();

  if (!scenarioId) {
    return NextResponse.json({ error: "scenario_id required" }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: quote } = await db
    .from("quotes")
    .select("id, is_multi_scenario, public_action_token, status, accepted_scenario_id")
    .eq("quote_id", quoteId)
    .maybeSingle();

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  // Validate token (public_action_token protects unauthenticated mutation)
  if (!token || token !== (quote as { public_action_token?: string | null }).public_action_token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  if (!(quote as { is_multi_scenario?: boolean }).is_multi_scenario) {
    return NextResponse.json({ error: "This quote does not have multiple scenarios" }, { status: 400 });
  }

  // Verify scenario belongs to this quote
  const { data: scenario } = await db
    .from("quote_scenarios")
    .select("id, quote_id")
    .eq("id", scenarioId)
    .eq("quote_id", quote.id)
    .maybeSingle();

  if (!scenario) {
    return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  // Mark all scenarios for this quote as pending, then mark selected one
  await db
    .from("quote_scenarios")
    .update({ status: "pending", selected_at: null })
    .eq("quote_id", quote.id);

  await db
    .from("quote_scenarios")
    .update({ status: "selected", selected_at: now })
    .eq("id", scenarioId);

  // Write accepted_scenario_id onto the quote and update status to viewed if still sent/draft
  const quoteUpdate: Record<string, unknown> = {
    accepted_scenario_id: scenarioId,
    updated_at: now,
  };
  const currentStatus = String((quote as { status?: string }).status ?? "");
  if (currentStatus === "sent" || currentStatus === "draft") {
    quoteUpdate.status = "viewed";
    quoteUpdate.viewed_at = now;
  }
  await db.from("quotes").update(quoteUpdate).eq("id", quote.id);

  return NextResponse.json({ ok: true });
}
