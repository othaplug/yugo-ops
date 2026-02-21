import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";

const DEFAULT_READINESS_ITEMS = [
  { label: "Truck in good condition", status: "ok" as const, note: null },
  { label: "Equipment & supplies ready", status: "ok" as const, note: null },
  { label: "Dolly, straps, blankets", status: "ok" as const, note: null },
  { label: "First aid kit accessible", status: "ok" as const, note: null },
  { label: "Fuel level adequate", status: "ok" as const, note: null },
];

/** GET: Check if today's readiness is done for the team */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().split("T")[0];
  const admin = createAdminClient();

  const { data: check } = await admin
    .from("readiness_checks")
    .select("id, passed, flagged_items, completed_at")
    .eq("team_id", payload.teamId)
    .eq("check_date", today)
    .maybeSingle();

  return NextResponse.json({
    completed: !!check,
    passed: check?.passed ?? null,
    flaggedItems: check?.flagged_items ?? [],
    completedAt: check?.completed_at ?? null,
    isCrewLead: payload.role === "lead",
    items: DEFAULT_READINESS_ITEMS,
  });
}

/** POST: Submit readiness check (crew lead only) */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (payload.role !== "lead") {
    return NextResponse.json({ error: "Only crew lead can complete readiness check" }, { status: 403 });
  }

  const body = await req.json();
  const items = Array.isArray(body.items) ? body.items : [];
  const note = (body.note || "").toString().trim() || null;

  const flaggedItems: string[] = [];
  for (const item of items) {
    if (item?.status === "issue" && item?.label) {
      flaggedItems.push(item.label);
    }
  }
  const passed = flaggedItems.length === 0;

  const today = new Date().toISOString().split("T")[0];
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("readiness_checks")
    .select("id")
    .eq("team_id", payload.teamId)
    .eq("check_date", today)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Readiness check already completed for today" }, { status: 400 });
  }

  const { data: inserted, error } = await admin
    .from("readiness_checks")
    .insert({
      team_id: payload.teamId,
      truck_id: null,
      crew_lead_id: payload.crewMemberId,
      check_date: today,
      items,
      passed,
      flagged_items: flaggedItems,
      note,
    })
    .select("id, passed, completed_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(inserted);
}
