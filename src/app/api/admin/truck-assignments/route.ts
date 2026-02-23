import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

/** GET: List truck assignments for a date. Query: ?date=YYYY-MM-DD */
export async function GET(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const date = (req.nextUrl.searchParams.get("date") || "").trim();
  const useDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().split("T")[0];

  const admin = createAdminClient();

  const { data: assignments, error } = await admin
    .from("truck_assignments")
    .select("id, truck_id, team_id, date")
    .eq("date", useDate)
    .order("truck_id");

  if (error) {
    console.error("[truck-assignments] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const trucksRes = await admin.from("trucks").select("id, name").order("name");
  const teamsRes = await admin.from("crews").select("id, name").order("name");

  const trucks = trucksRes.data || [];
  const teams = teamsRes.data || [];

  return NextResponse.json({
    date: useDate,
    assignments: assignments || [],
    trucks,
    teams,
  });
}

/** POST: Set or update truck assignment. Body: { truckId, teamId, date } */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const truckId = (body.truckId || "").toString().trim();
    const teamId = (body.teamId || "").toString().trim();
    const date = (body.date || "").toString().trim();
    const useDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().split("T")[0];

    if (!truckId || !teamId) {
      return NextResponse.json({ error: "truckId and teamId required" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data, error } = await admin
      .from("truck_assignments")
      .upsert(
        { truck_id: truckId, team_id: teamId, date: useDate },
        { onConflict: "truck_id,date" }
      )
      .select("id, truck_id, team_id, date")
      .single();

    if (error) {
      console.error("[truck-assignments] POST error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("[truck-assignments] error:", e);
    return NextResponse.json({ error: "Failed to set assignment" }, { status: 500 });
  }
}

/** DELETE: Remove truck assignment. Query: ?truckId=xxx&date=YYYY-MM-DD */
export async function DELETE(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const truckId = req.nextUrl.searchParams.get("truckId")?.trim();
  const date = req.nextUrl.searchParams.get("date")?.trim();
  const useDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().split("T")[0];

  if (!truckId) {
    return NextResponse.json({ error: "truckId required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("truck_assignments")
    .delete()
    .eq("truck_id", truckId)
    .eq("date", useDate);

  if (error) {
    console.error("[truck-assignments] DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
