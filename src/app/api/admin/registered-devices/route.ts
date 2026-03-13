import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/auth/check-role";

export async function GET() {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("registered_devices")
    .select("id, device_id, device_name, truck_id, default_team_id, phone, is_active, last_active_at, registered_at")
    .order("registered_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { id, phone, device_name, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: "Device id is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof phone === "string") updates.phone = phone.trim();
    if (typeof device_name === "string") updates.device_name = device_name.trim();
    if (typeof is_active === "boolean") updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("registered_devices")
      .update(updates)
      .eq("id", id)
      .select("id, device_id, device_name, truck_id, default_team_id, phone, is_active")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update" },
      { status: 500 },
    );
  }
}
