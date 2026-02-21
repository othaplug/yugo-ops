import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

function generateCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // exclude I, O for clarity
  const digits = "23456789"; // exclude 0, 1 for clarity
  let part1 = "";
  for (let i = 0; i < 4; i++) part1 += letters[Math.floor(Math.random() * letters.length)];
  let part2 = "";
  for (let i = 0; i < 4; i++) part2 += digits[Math.floor(Math.random() * digits.length)];
  return `${part1}-${part2}`;
}

/** GET: List trucks, teams, recent setup codes (admin only) */
export async function GET() {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const admin = createAdminClient();

  const [trucksRes, crewsRes, codesRes] = await Promise.all([
    admin.from("trucks").select("id, name").order("name"),
    admin.from("crews").select("id, name").order("name"),
    admin.from("device_setup_codes").select("id, code, truck_id, default_team_id, device_name, expires_at, used_at, created_at").order("created_at", { ascending: false }).limit(20),
  ]);

  const trucks = trucksRes.data || [];
  const teams = crewsRes.data || [];
  const codes = codesRes.data || [];

  return NextResponse.json({ trucks, teams, codes });
}

/** POST: Create a new setup code (admin only) */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const truckId = (body.truckId || "").toString().trim() || null;
    const teamId = (body.teamId || "").toString().trim() || null;
    const deviceName = (body.deviceName || "").toString().trim() || null;
    const expiresInHours = Math.min(168, Math.max(1, Number(body.expiresInHours) || 24)); // 1–168 hours

    const admin = createAdminClient();

    // Ensure at least one of truck or team is set
    if (!truckId && !teamId) {
      return NextResponse.json({ error: "Select at least a truck or team" }, { status: 400 });
    }

    let code = generateCode();
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await admin.from("device_setup_codes").select("id").eq("code", code).maybeSingle();
      if (!existing) break;
      code = generateCode();
      attempts++;
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    const { data: inserted, error } = await admin
      .from("device_setup_codes")
      .insert({
        code,
        truck_id: truckId || null,
        default_team_id: teamId || null,
        device_name: deviceName || null,
        expires_at: expiresAt.toISOString(),
      })
      .select("id, code, truck_id, default_team_id, device_name, expires_at, created_at")
      .single();

    if (error) {
      console.error("[device-setup-codes] insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(inserted);
  } catch (e) {
    console.error("[device-setup-codes] error:", e);
    return NextResponse.json({ error: "Failed to create setup code" }, { status: 500 });
  }
}
